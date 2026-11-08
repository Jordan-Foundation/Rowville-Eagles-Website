import type { Payload } from 'payload'
import type { Promotion } from '@/payload-types'
import { bestPromo, covers, discountLabel, type LivePromo, type Target } from './rules'

const ids = (v: unknown) => (Array.isArray(v) ? v.map((x) => (x && typeof x === 'object' ? (x as { id: number }).id : (x as number))).filter((x) => typeof x === 'number') : [])
/** A pending use stops counting after this long (an abandoned checkout). */
const PENDING_MS = 2 * 60 * 60 * 1000

export const toLive = (d: Promotion): LivePromo => ({
  id: d.id,
  name: d.name,
  status: d.status,
  type: d.type,
  value: d.value,
  startsAt: d.startsAt,
  endsAt: d.endsAt,
  usesPerFamily: d.usesPerFamily,
  everything: d.everything,
  programGroups: d.programGroups ?? [],
  programs: ids(d.programs),
  oneOnOneAll: d.oneOnOneAll,
  oneOnOneTerms: ids(d.oneOnOneTerms),
  shopAll: d.shopAll,
  products: ids(d.products),
  tournamentsAll: d.tournamentsAll,
  tournamentRounds: ids(d.tournamentRounds),
  foundationPlus: d.foundationPlus,
})

/** Live promotions this account received. */
export async function promosFor(p: Payload, userId: number | null | undefined): Promise<LivePromo[]> {
  if (!userId) return []
  const { docs } = await p.find({ pagination: false, collection: 'promotions', where: { status: { equals: 'live' }, recipients: { in: [userId] } }, limit: 50, depth: 0, overrideAccess: true })
  return docs.map(toLive)
}

export async function usesFor(p: Payload, userId: number, promoIds: number[]) {
  const m = new Map<number, number>()
  if (!promoIds.length) return m
  const { docs } = await p.find({
    collection: 'promotion-uses',
    where: { account: { equals: userId }, promotion: { in: promoIds }, or: [{ status: { equals: 'paid' } }, { and: [{ status: { equals: 'pending' } }, { createdAt: { greater_than: new Date(Date.now() - PENDING_MS).toISOString() } }] }] },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
    select: { promotion: true },
  })
  for (const u of docs) { const id = ids([u.promotion])[0]; m.set(id, (m.get(id) ?? 0) + 1) }
  return m
}

export type Applied = { promotion: number; name: string; off: number; label: string }

/**
 * The best promotion for a purchase. `lines` are the things being paid for, each with its amount; the
 * discount is worked out on the lines the promotion covers (e.g. only some shop items).
 */
export async function findDiscount(p: Payload, userId: number | null | undefined, lines: { target: Target; amount: number }[], now = new Date()): Promise<Applied | null> {
  const promos = await promosFor(p, userId)
  if (!promos.length || !userId) return null
  const uses = await usesFor(p, userId, promos.map((x) => x.id))
  const best = bestPromo(promos, uses, (promo) => lines.filter((l) => covers(promo, l.target)).reduce((n, l) => n + l.amount, 0), now)
  return best ? { promotion: best.promo.id, name: best.promo.name, off: best.off, label: `${best.promo.name} — ${discountLabel(best.promo)}` } : null
}

/** Which lines a promotion covers (to spread a shop discount over the right items). */
export async function coveredLines(p: Payload, promotionId: number, targets: Target[]) {
  const d = await p.findByID({ collection: 'promotions', id: promotionId, depth: 0, overrideAccess: true })
  const live = toLive(d)
  return targets.map((t) => covers(live, t))
}

export async function recordUse(p: Payload, o: { applied: Applied; account: number; kind: 'program' | '1on1' | 'shop' | 'tournament' | 'fplus'; reference: string; paidAmount: number }) {
  await p.create({ collection: 'promotion-uses', overrideAccess: true, data: { promotion: o.applied.promotion, account: o.account, kind: o.kind, reference: o.reference, amountOff: o.applied.off, paidAmount: o.paidAmount, status: 'pending' } })
}

/** Mark uses for a reference paid (after payment) or cancelled (checkout expired / released). */
export async function settleUses(p: Payload, reference: string, status: 'paid' | 'cancelled') {
  try {
    await p.update({ collection: 'promotion-uses', where: { reference: { equals: reference }, status: { equals: 'pending' } }, data: { status }, overrideAccess: true })
  } catch (e) {
    p.logger.error({ err: e, msg: `Could not mark promotion use ${reference} ${status}` })
  }
}

/** ["Discount", "Winter special −$33.00"] for a paid booking/order that used a promotion, or null. */
export async function discountLine(p: Payload, d: { discount?: number | null; promotion?: unknown }): Promise<[string, string] | null> {
  if (!d.discount || d.discount <= 0) return null
  const id = d.promotion && typeof d.promotion === 'object' ? (d.promotion as { id: number }).id : (d.promotion as number | null | undefined)
  const promo = id ? await p.findByID({ collection: 'promotions', id, depth: 0, overrideAccess: true, disableErrors: true }) : null
  const { formatAUD } = await import('../lib/format')
  return ['Discount', `${promo?.name ?? 'Promotion'} −${formatAUD(d.discount)}`]
}
