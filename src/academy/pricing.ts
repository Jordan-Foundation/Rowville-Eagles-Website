import type { Payload } from 'payload'
import type { AcademyTerm } from '@/payload-types'

const DAY = 86_400_000

/**
 * Casual price for one session (pure). Families with an active term booking pay the term-member price,
 * but only for sessions starting within the window (default 14 days) of the moment they book — so the
 * offer fills near-term gaps and can't be used to book a whole extra term cheaply.
 */
export function casualPrice(
  term: Pick<AcademyTerm, 'casualPrice' | 'termMemberPrice' | 'termMemberWindowDays'>,
  o: { startsAt: string; now: Date; termMember: boolean },
): { price: number; memberPrice: boolean } {
  const until = memberWindowEnd(term, o.now)
  const eligible = o.termMember && term.termMemberPrice != null && term.termMemberPrice < term.casualPrice && new Date(o.startsAt).getTime() <= until.getTime()
  return eligible ? { price: term.termMemberPrice!, memberPrice: true } : { price: term.casualPrice, memberPrice: false }
}

export const memberWindowEnd = (term: Pick<AcademyTerm, 'termMemberWindowDays'>, now: Date) => new Date(now.getTime() + (term.termMemberWindowDays ?? 14) * DAY)

/** Does this family have an active term booking (confirmed, with sessions still to come)? */
export async function isTermMember(payload: Payload, accountId: number | null | undefined, now = new Date()) {
  if (!accountId) return false
  const { docs } = await payload.find({
    collection: 'academy-bookings',
    where: { account: { equals: accountId }, type: { equals: 'term' }, status: { in: ['confirmed', 'payment_failed'] } },
    limit: 20,
    depth: 0,
    overrideAccess: true,
    select: { reference: true },
  })
  if (!docs.length) return false
  const { totalDocs } = await payload.count({
    collection: 'academy-sessions',
    where: { booking: { in: docs.map((d) => d.id) }, status: { equals: 'scheduled' }, startsAt: { greater_than: now.toISOString() } },
    overrideAccess: true,
  })
  return totalDocs > 0
}
