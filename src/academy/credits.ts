import type { Payload, PayloadRequest } from 'payload'

const round = (n: number) => Math.round(n * 100) / 100

/** Available account credit (AUD): everything given, less everything used or reserved by a checkout in progress. */
export async function creditBalance(payload: Payload, accountId: number, req?: PayloadRequest) {
  return Math.max(0, await creditSum(payload, accountId, req))
}

/** Raw ledger sum — negative only if two checkouts reserved the same credit at once. */
export async function creditSum(payload: Payload, accountId: number, req?: PayloadRequest) {
  const { docs } = await payload.find({
    collection: 'academy-credits',
    where: { account: { equals: accountId }, status: { in: ['active', 'pending'] } },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
    req,
    select: { amount: true },
  })
  return round(docs.reduce((n, d) => n + d.amount, 0))
}

export async function giveCredit(
  payload: Payload,
  c: { account: number; amount: number; reason: 'cancellation' | 'coach_cancellation' | 'goodwill' | 'adjustment'; booking?: number; note?: string; createdBy?: number },
  req?: PayloadRequest,
) {
  if (c.amount <= 0) return null
  return payload.create({ collection: 'academy-credits', overrideAccess: true, req, data: { ...c, amount: round(c.amount), status: 'active' } })
}

/** Hold credit for a checkout. Becomes final when paid; released if the checkout is abandoned. */
export async function reserveCredit(payload: Payload, c: { account: number; amount: number; booking: number }, req?: PayloadRequest) {
  if (c.amount <= 0) return null
  return payload.create({
    collection: 'academy-credits',
    overrideAccess: true,
    req,
    data: { account: c.account, amount: -round(c.amount), booking: c.booking, reason: 'used', status: 'pending', note: 'Used at checkout' },
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
