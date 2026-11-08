import 'server-only'
import { createHash, randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { getFieldsToSign, jwtSign, type Payload } from 'payload'
import { addSessionToUser } from 'payload/shared'

export const LOGIN_LINK_MINUTES = 20
const hash = (token: string) => createHash('sha256').update(token).digest('hex')

/** A one-use login link token for this user (only its hash is stored). */
export async function createLoginLink(p: Payload, userId: number) {
  const token = randomBytes(32).toString('base64url')
  await p.update({
    collection: 'users',
    id: userId,
    data: { loginLinkHash: hash(token), loginLinkExpires: new Date(Date.now() + LOGIN_LINK_MINUTES * 60_000).toISOString() },
    overrideAccess: true,
    context: { skipRefresh: true },
  })
  return token
}

/** The account a login link belongs to, if it's still valid (doesn't use it up). */
export async function loginLinkUser(p: Payload, token: string) {
  if (!/^[\w-]{30,60}$/.test(token)) return null
  const { docs } = await p.find({ collection: 'users', where: { loginLinkHash: { equals: hash(token) } }, limit: 1, depth: 0, overrideAccess: true, pagination: false, showHiddenFields: true })
  const u = docs[0]
  if (!u?.loginLinkExpires || new Date(u.loginLinkExpires) < new Date()) return null
  return u
}

/** Use up a login link and sign the family in (same session cookie as the normal login). */
export async function useLoginLink(p: Payload, token: string) {
  const found = await loginLinkUser(p, token)
  if (!found) return null
  await p.update({ collection: 'users', id: found.id, data: { loginLinkHash: null, loginLinkExpires: null, activated: true }, overrideAccess: true, context: { skipRefresh: true } })
  const collectionConfig = p.collections.users.config
  const user = (await p.db.findOne({ collection: 'users', where: { id: { equals: found.id } } })) as Record<string, unknown> & { id: number; email: string }
  const { sid } = await addSessionToUser({ collectionConfig, payload: p, req: { payload: p } as never, user: user as never })
  const fieldsToSign = getFieldsToSign({ collectionConfig, email: user.email, user: user as never, ...(sid ? { sid } : {}) })
  const { token: jwt } = await jwtSign({ fieldsToSign, secret: p.secret, tokenExpiration: collectionConfig.auth.tokenExpiration })
  ;(await cookies()).set(`${p.config.cookiePrefix}-token`, jwt, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: collectionConfig.auth.tokenExpiration,
  })
  return found
}
