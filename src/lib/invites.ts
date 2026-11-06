import { createHash, randomBytes } from 'crypto'
import type { Payload, PayloadRequest } from 'payload'
import type { InviteToken } from '@/payload-types'

export type InvitePurpose = InviteToken['purpose']

const hash = (token: string) => createHash('sha256').update(token).digest('hex')

/** Days a create-account link stays valid (env INVITE_TTL_DAYS, default 14). */
export const inviteTtlDays = () => Number(process.env.INVITE_TTL_DAYS) || 14

/** Create a single-use token for a user and return the raw token (only ever sent by email, never stored). */
export async function createInvite(
  payload: Payload,
  opts: { userId: number; email: string; purpose: InvitePurpose; ttlDays?: number; req?: PayloadRequest },
): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + (opts.ttlDays ?? inviteTtlDays()) * 86400000).toISOString()
  await payload.create({
    collection: 'invite-tokens',
    overrideAccess: true,
    req: opts.req,
    data: { purpose: opts.purpose, user: opts.userId, email: opts.email, tokenHash: hash(token), expiresAt },
  })
  return token
}

export type InviteCheck =
  | { ok: true; invite: InviteToken; userId: number }
  | { ok: false; reason: 'missing' | 'invalid' | 'used' | 'expired' }

/** Look up a token without consuming it. */
export async function checkInvite(payload: Payload, token: string | undefined, purpose: InvitePurpose): Promise<InviteCheck> {
  if (!token) return { ok: false, reason: 'missing' }
  const { docs } = await payload.find({
    collection: 'invite-tokens',
    where: { tokenHash: { equals: hash(token) }, purpose: { equals: purpose } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const invite = docs[0]
  if (!invite) return { ok: false, reason: 'invalid' }
  if (invite.usedAt) return { ok: false, reason: 'used' }
  if (new Date(invite.expiresAt) < new Date()) return { ok: false, reason: 'expired' }
  return { ok: true, invite, userId: typeof invite.user === 'object' ? invite.user.id : invite.user }
}

export async function consumeInvite(payload: Payload, inviteId: number, req?: PayloadRequest) {
  await payload.update({ collection: 'invite-tokens', id: inviteId, data: { usedAt: new Date().toISOString() }, overrideAccess: true, req })
}

/** Housekeeping (daily cron): remove tokens that expired more than 30 days ago. */
export async function purgeOldInvites(payload: Payload) {
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString()
  const res = await payload.delete({ collection: 'invite-tokens', where: { expiresAt: { less_than: cutoff } }, overrideAccess: true })
  return { deleted: res.docs.length }
}
