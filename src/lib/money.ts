import type { Payload } from 'payload'

/** Money summary for Management, to check against the two Stripe accounts (pure parts unit tested). */

export type Category = 'one-on-one' | 'small-group' | 'academy-terms' | 'camps' | 'trials' | 'registrations' | 'tournaments' | 'shop'
export const CATEGORY_LABEL: Record<Category, string> = {
  'one-on-one': '1-on-1 sessions',
  'small-group': 'Small group sessions',
  'academy-terms': 'Academy terms & Mini Ballers',
  camps: 'Camps & programs',
  trials: 'Trials',
  registrations: 'Club registrations',
  tournaments: 'Tournaments',
  shop: 'Shop',
}
export type Entry = { category: Category; payee: 'club' | 'academy'; at: string; gross?: number; discount?: number; refund?: number }
export type Line = { category: Category; count: number; gross: number; discount: number; refunds: number; net: number }

const r2 = (n: number) => Math.round(n * 100) / 100

/** Totals per category and per Stripe account for entries between from and to (inclusive, ISO). */
export function summarise(entries: Entry[], from: string, to: string) {
  const inside = entries.filter((e) => e.at >= from && e.at <= to)
  const lines = new Map<Category, Line>()
  const accounts = { club: { gross: 0, refunds: 0, net: 0 }, academy: { gross: 0, refunds: 0, net: 0 } }
  for (const e of inside) {
    const l = lines.get(e.category) ?? { category: e.category, count: 0, gross: 0, discount: 0, refunds: 0, net: 0 }
    if (e.gross) l.count++
    l.gross = r2(l.gross + (e.gross ?? 0))
    l.discount = r2(l.discount + (e.discount ?? 0))
    l.refunds = r2(l.refunds + (e.refund ?? 0))
    l.net = r2(l.gross - l.refunds)
    lines.set(e.category, l)
    const a = accounts[e.payee]
    a.gross = r2(a.gross + (e.gross ?? 0))
    a.refunds = r2(a.refunds + (e.refund ?? 0))
    a.net = r2(a.gross - a.refunds)
  }
  const ordered = (Object.keys(CATEGORY_LABEL) as Category[]).map((c) => lines.get(c)).filter((l): l is Line => Boolean(l))
  const total = ordered.reduce((t, l) => ({ count: t.count + l.count, gross: r2(t.gross + l.gross), discount: r2(t.discount + l.discount), refunds: r2(t.refunds + l.refunds), net: r2(t.net + l.net) }), { count: 0, gross: 0, discount: 0, refunds: 0, net: 0 })
  return { lines: ordered, total, accounts }
}

const q = { overrideAccess: true, pagination: false } as const

/** Every card payment and refund the site knows about, as entries (amounts in dollars). */
export async function moneyEntries(p: Payload, since: string): Promise<Entry[]> {
  const out: Entry[] = []
  const [ab, b, o] = await Promise.all([
    p.find({ ...q, collection: 'academy-bookings', where: { updatedAt: { greater_than: since }, status: { not_equals: 'held' } }, limit: 20000, depth: 0 }),
    p.find({ ...q, collection: 'bookings', where: { updatedAt: { greater_than: since }, status: { in: ['paid', 'refunded'] } }, limit: 20000, depth: 1 }),
    p.find({ ...q, collection: 'orders', where: { updatedAt: { greater_than: since }, status: { in: ['paid', 'ready', 'completed', 'refunded'] } }, limit: 20000, depth: 0 }),
  ])
  for (const x of ab.docs) {
    const category: Category = x.kind === 'group' ? 'small-group' : 'one-on-one'
    const paidUpFront = ['confirmed', 'completed', 'payment_failed'].includes(x.status) || (x.status === 'cancelled' && (x.adjustments ?? []).length > 0)
    if (x.paymentMode === 'weekly') {
      if (paidUpFront) out.push({ category, payee: 'academy', at: x.createdAt, gross: x.amount / (x.sessionsTotal || 1), discount: (x.discount ?? 0) / (x.sessionsTotal || 1) })
      for (const pay of x.payments ?? []) if (pay.status === 'paid' && pay.at && pay.amount) out.push({ category, payee: 'academy', at: pay.at, gross: pay.amount })
    } else if (paidUpFront) {
      const card = x.amount - (x.creditApplied ?? 0)
      if (card > 0) out.push({ category, payee: 'academy', at: x.createdAt, gross: card, discount: x.discount ?? 0 })
    }
    for (const a of x.adjustments ?? []) if ((a.cash ?? 0) > 0 && (a.refundStatus === 'refunded' || a.refundStatus === 'simulated') && a.at) out.push({ category, payee: 'academy', at: a.at, refund: a.cash! })
  }
  for (const x of b.docs) {
    const prog = typeof x.program === 'object' ? x.program : null
    const cat: Category = x.bookingType === 'trial' ? 'trials' : prog?.type === 'academy-term' || prog?.type === 'toddler' ? 'academy-terms' : prog?.type === 'registration' ? 'registrations' : prog?.type === 'tournament' ? 'tournaments' : 'camps'
    const payee = x.payee === 'club' ? 'club' : 'academy'
    if (x.amount > 0) out.push({ category: cat, payee, at: x.createdAt, gross: x.amount, discount: x.discount ?? 0 })
    if (x.status === 'refunded' && x.amount > 0) out.push({ category: cat, payee, at: x.updatedAt, refund: x.amount })
  }
  for (const x of o.docs) {
    const payee = x.payee === 'club' ? 'club' : 'academy'
    out.push({ category: 'shop', payee, at: x.createdAt, gross: x.total, discount: x.discount ?? 0 })
    if (x.status === 'refunded') out.push({ category: 'shop', payee, at: x.updatedAt, refund: x.total })
  }
  return out
}
