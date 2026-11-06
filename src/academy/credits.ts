import type { Payload, PayloadRequest } from 'payload'
import { creditState, expiryFrom, type CreditState } from './credit-ledger'

/** Session credits: one credit = one 1-on-1. Expire 12 months after they're given. */

export async function creditStateFor(payload: Payload, accountId: number, req?: PayloadRequest): Promise<CreditState> {
  const { docs } = await payload.find({
    collection: 'academy-credits',
    where: { account: { equals: accountId }, status: { in: ['active', 'pending'] } },
    limit: 2000,
    depth: 0,
    overrideAccess: true,
    req,
    select: { sessions: true, status: true, createdAt: true, expiresAt: true },
  })
  return creditState(docs.map((d) => ({ id: d.id, sessions: d.sessions, status: d.status, createdAt: d.createdAt, expiresAt: d.expiresAt })))
}

/** Session credits available now. */
export async function creditBalance(payload: Payload, accountId: number, req?: PayloadRequest) {
  return (await creditStateFor(payload, accountId, req)).available
}

export async function giveCredit(
  payload: Payload,
  c: { account: number; sessions: number; value?: number; reason: 'cancellation' | 'coach_cancellation' | 'goodwill' | 'adjustment'; booking?: number; note?: string; createdBy?: number },
  req?: PayloadRequest,
) {
  const sessions = Math.floor(c.sessions)
  if (sessions <= 0) return null
  return payload.create({
    collection: 'academy-credits',
    overrideAccess: true,
    req,
    data: { account: c.account, sessions, amount: c.value, reason: c.reason, booking: c.booking, note: c.note, createdBy: c.createdBy, status: 'active', expiresAt: expiryFrom(new Date()) },
  })
}

/** Hold credits for a checkout. Become final when paid; released if the checkout is abandoned. */
export async function reserveCredit(payload: Payload, c: { account: number; sessions: number; value: number; booking: number }, req?: PayloadRequest) {
  if (c.sessions <= 0) return null
  return payload.create({
    collection: 'academy-credits',
    overrideAccess: true,
    req,
    data: { account: c.account, sessions: -c.sessions, amount: -c.value, booking: c.booking, reason: 'used', status: 'pending', note: 'Used at checkout' },
  })
}

export async function settleReservedCredit(payload: Payload, bookingId: number, outcome: 'active' | 'void', req?: PayloadRequest) {
  await payload.update({
    collection: 'academy-credits',
    where: { booking: { equals: bookingId }, reason: { equals: 'used' }, status: { equals: 'pending' } },
    data: { status: outcome },
    overrideAccess: true,
    req,
  })
}
