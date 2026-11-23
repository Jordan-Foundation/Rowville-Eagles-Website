import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Signed links in follow-up emails: "<booking reference>.<signature>". They reopen that booking's form pre-filled,
 * add trial details, or stop the follow-ups — without a login, and they can't be edited to reach someone else's booking.
 */
const secret = () => {
  const s = process.env.PAYLOAD_SECRET
  if (!s) throw new Error('PAYLOAD_SECRET is required to sign follow-up links')
  return s
}
const sign = (ref: string) => createHmac('sha256', secret()).update(`follow-up:${ref}`).digest('base64url').slice(0, 24)

export const makeFollowToken = (reference: string) => `${reference}.${sign(reference)}`

export function readFollowToken(token: string | null | undefined): string | null {
  if (!token) return null
  const i = token.lastIndexOf('.')
  if (i <= 0) return null
  const ref = token.slice(0, i)
  if (!/^[A-Za-z0-9-]{4,40}$/.test(ref)) return null
  const a = Buffer.from(sign(ref))
  const b = Buffer.from(token.slice(i + 1))
  return a.length === b.length && timingSafeEqual(a, b) ? ref : null
}
