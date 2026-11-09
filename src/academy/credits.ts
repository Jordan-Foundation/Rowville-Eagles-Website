import type { Payload, PayloadRequest } from 'payload'
import { creditState, expiryFrom, type CreditState } from './credit-ledger'

/**
 * Session credits: one credit = one session. Expire 12 months after they're given.
 * Two separate balances: `any` (1-on-1 credits, the default everywhere) and `group` (from small group
 * sessions — they can only pay for small group sessions).
 */
export type CreditScope = 'any' | 'group'

export async function creditStateFor(payload: Payload, accountId: number, req?: PayloadRequest, scope: CreditScope = 'any'): Promise<CreditState> {
  const { docs } = await payload.find({
    collection: 'academy-credits',
    where: { account: { equals: accountId }, status: { in: ['active', 'pending'] }, scope: { equals: scope } },
    limit: 2000,
    depth: 0,
    overrideAccess: true,
    req,
    select: { sessions: true, status: true, createdAt: true, expiresAt: true },
  })
  return creditState(docs.map((d) => ({ id: d.id, sessions: d.sessions, status: d.status, createdAt: d.createdAt, expiresAt: d.expiresAt })))
}

/** Session credits available now. */
export async function creditBalance(payload: Payload, accountId: number, req?: PayloadRequest, scope: CreditScope = 'any') {
  return (await creditStateFor(payload, accountId, req, scope)).available
}

export async function giveCredit(
  payload: Payload,
  c: { account: number; sessions: number; value?: number; reason: 'cancellation' | 'coach_cancellation' | 'goodwill' | 'adjustment'; booking?: number; note?: string; createdBy?: number; scope?: CreditScope },
  req?: PayloadRequest,
) {
  const sessions = Math.floor(c.sessions)
  if (sessions <= 0) return null
  return payload.create({
    collection: 'academy-credits',
    overrideAccess: true,
    req,
    data: { account: c.account, sessions, amount: c.value, reason: c.reason, booking: c.booking, note: c.note, createdBy: c.createdBy, status: 'active', expiresAt: expiryFrom(new Date()), scope: c.scope ?? 'any' },
  })
}

/** Hold credits for a checkout. Become final when paid; released if the checkout is abandoned. */
export async function reserveCredit(payload: Payload, c: { account: number; sessions: number; value: number; booking: number; scope?: CreditScope }, req?: PayloadRequest) {
  if (c.sessions <= 0) return null
  return payload.create({
    collection: 'academy-credits',
    overrideAccess: true,
    req,
    data: { account: c.account, sessions: -c.sessions, amount: -c.value, booking: c.booking, reason: 'used', status: 'pending', note: 'Used at checkout', scope: c.scope ?? 'any' },
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
