import type { Payload, Where } from 'payload'
import type { AcademyBooking, Booking, Invoice, Order, Program } from '../payload-types'
import { paymentsMode, stripeFor, type Payee } from '../lib/stripe-accounts'
import { emailLayout, esc } from '../lib/email-templates'
import { sendEmail } from '../lib/email'
import { formatAUD } from '../lib/format'
import { refundToCard } from '../academy/refunds'
import { cancelAcademy } from '../academy/cancellations'
import { bookingMoneyCategory } from '../lib/money'

const q = { overrideAccess: true, depth: 0 } as const
const r2 = (n: number) => Math.round(n * 100) / 100
const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null | undefined)) ?? null

export type Kind = 'booking' | 'academy' | 'order' | 'invoice'
export class RefundError extends Error {}

/** One payment as the Refunds page lists it. */
export type Txn = {
  kind: Kind
  id: number
  reference: string
  /** Money summary line */
  category: string
  at: string
  payee: Payee
  description: string
  player: string
  family: string
  email: string
  account: number | null
  paid: number
  refunded: number
  refundable: number
  status: string
  /** Can the booking be cancelled as part of the refund? */
  cancellable: boolean
  /** Why it can't be refunded by card (cash, nothing paid…) */
  note?: string
}

const name = (a?: { firstName?: string | null; lastName?: string | null } | null) => [a?.firstName, a?.lastName].filter(Boolean).join(' ')

/** Pure: how much is left to refund (unit tested). */
export const refundableLeft = (paid: number, refunded: number) => Math.max(0, r2(paid - refunded))

/** What a refund request may be, or why not (pure — unit tested). */
export function checkAmount(amount: number, left: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return 'Enter an amount above $0.'
  if (Math.round(amount * 100) > Math.round(left * 100)) return `You can refund up to ${formatAUD(left)} on this payment.`
  return null
}

async function ledgerTotals(p: Payload, kind: Kind, ids: number[]) {
  if (!ids.length) return new Map<number, number>()
  const { docs } = await p.find({ collection: 'refunds', where: { kind: { equals: kind }, docId: { in: ids }, status: { in: ['refunded', 'simulated'] } }, limit: 5000, pagination: false, ...q })
  const m = new Map<number, number>()
  for (const d of docs) m.set(d.docId, r2((m.get(d.docId) ?? 0) + d.amount))
  return m
}

const academyRefunded = (b: AcademyBooking) => r2((b.adjustments ?? []).reduce((n, a) => n + ((a.refundStatus === 'refunded' || a.refundStatus === 'simulated') ? (a.cash ?? 0) : 0), 0))
const academyPaid = (b: AcademyBooking) =>
  b.paymentMode === 'weekly'
    ? r2((b.payments ?? []).reduce((n, x) => n + (x.status === 'paid' ? (x.amount ?? 0) : 0), 0))
    : ['confirmed', 'completed', 'payment_failed'].includes(b.status) || (b.adjustments ?? []).length ? r2((b.amount ?? 0) - (b.creditApplied ?? 0)) : 0

/** Find families, players and payments matching a name, email, phone or reference — then every payment of those families. */
export async function searchTransactions(p: Payload, query: string): Promise<Txn[]> {
  const term = query.trim()
  if (term.length < 2) return []
  const like = { like: term }
  const words = term.split(/\s+/).filter(Boolean)
  const nameWhere = (first: string, last: string): Where =>
    words.length > 1 ? { and: [{ [first]: { like: words[0] } }, { [last]: { like: words.slice(1).join(' ') } }] } : { or: [{ [first]: like }, { [last]: like }] }

  // Accounts: parents by name/email/phone, and the families of players with that name
  const [users, kids] = await Promise.all([
    p.find({ collection: 'users', where: { or: [nameWhere('firstName', 'lastName'), { email: like }, { phone: like }] }, limit: 30, pagination: false, ...q, select: { email: true } }),
    p.find({ collection: 'participants', where: nameWhere('firstName', 'lastName'), limit: 30, pagination: false, ...q, select: { account: true } }),
  ])
  // Bookings in that player's or parent's name tell us their family (account or email) — then show everything that family paid
  const direct: Where = { or: [nameWhere('player.firstName', 'player.lastName'), nameWhere('contact.firstName', 'contact.lastName'), { 'contact.email': like }, { reference: like }] }
  const [db, dab] = await Promise.all([
    p.find({ collection: 'bookings', where: direct, limit: 50, pagination: false, ...q, select: { account: true, contact: true } }),
    p.find({ collection: 'academy-bookings', where: direct, limit: 50, pagination: false, ...q, select: { account: true, contact: true } }),
  ])
  const found = [...db.docs, ...dab.docs]
  const accounts = [...new Set([...users.docs.map((u) => u.id), ...kids.docs.map((k) => idOf(k.account)), ...found.map((d) => idOf(d.account))].filter(Boolean) as number[])]
  const emails = [...new Set([...users.docs.map((u) => u.email), ...found.map((d) => d.contact?.email)].filter(Boolean).map((e) => String(e).toLowerCase()))]
  const byAccount: Where[] = accounts.length ? [{ account: { in: accounts } }] : []
  const byEmail = (field: string): Where[] => (emails.length ? [{ [field]: { in: emails } }] : [])

  const [bk, ab, od, iv] = await Promise.all([
    p.find({ collection: 'bookings', depth: 1, overrideAccess: true, limit: 200, pagination: false, sort: '-createdAt', where: { and: [{ status: { in: ['paid', 'refunded'] } }, { or: [...byAccount, ...byEmail('contact.email'), nameWhere('player.firstName', 'player.lastName'), nameWhere('contact.firstName', 'contact.lastName'), { 'contact.email': like }, { reference: like }] }] } }),
    p.find({ collection: 'academy-bookings', depth: 1, overrideAccess: true, limit: 200, pagination: false, sort: '-createdAt', where: { and: [{ status: { in: ['confirmed', 'completed', 'payment_failed', 'cancelled', 'refunded'] } }, { or: [...byAccount, ...byEmail('contact.email'), nameWhere('player.firstName', 'player.lastName'), nameWhere('contact.firstName', 'contact.lastName'), { 'contact.email': like }, { reference: like }] }] } }),
    p.find({ collection: 'orders', ...q, limit: 200, pagination: false, sort: '-createdAt', where: { and: [{ status: { in: ['paid', 'ready', 'completed', 'refunded'] } }, { or: [...byAccount, ...byEmail('contact.email'), { 'contact.name': like }, { 'contact.email': like }, { reference: like }] }] } }),
    p.find({ collection: 'invoices', ...q, limit: 200, pagination: false, sort: '-createdAt', where: { and: [{ status: { in: ['paid', 'refunded'] } }, { or: [...byAccount, ...byEmail('contactEmail'), { contactName: like }, { playerName: like }, { contactEmail: like }, { reference: like }] }] } }),
  ])
  const [lb, lo, li] = await Promise.all([ledgerTotals(p, 'booking', bk.docs.map((d) => d.id)), ledgerTotals(p, 'order', od.docs.map((d) => d.id)), ledgerTotals(p, 'invoice', iv.docs.map((d) => d.id))])

  const out: Txn[] = []
  for (const b of bk.docs as Booking[]) {
    const prog = typeof b.program === 'object' ? (b.program as Program) : null
    const paid = r2(b.amount ?? 0)
    // Refunded before the ledger existed (marked by hand): treat as fully refunded
    const refunded = lb.get(b.id) ?? (b.status === 'refunded' ? paid : 0)
    const days = b.fullCamp ? ' · full camp' : b.campDays?.length ? ` · ${b.campDays.length} day${b.campDays.length === 1 ? '' : 's'}` : ''
    out.push({
      kind: 'booking', id: b.id, reference: b.reference ?? '', category: bookingMoneyCategory(b, prog?.type), at: b.createdAt, payee: b.payee === 'club' ? 'club' : 'academy',
      description: `${b.bookingType === 'trial' ? 'Trial — ' : ''}${prog?.title ?? 'Booking'}${days}`,
      player: name(b.player), family: name(b.contact) || b.contact?.email || '', email: b.contact?.email ?? '', account: idOf(b.account),
      paid, refunded, refundable: b.stripeCheckoutId || paymentsMode(b.payee === 'club' ? 'club' : 'academy') === 'simulate' ? refundableLeft(paid, refunded) : 0,
      status: b.status, cancellable: b.status === 'paid',
      note: !paid ? 'Nothing was paid' : !b.stripeCheckoutId && paymentsMode(b.payee === 'club' ? 'club' : 'academy') !== 'simulate' ? 'No card payment on record' : undefined,
    })
  }
  for (const b of ab.docs as AcademyBooking[]) {
    const paid = academyPaid(b)
    const refunded = academyRefunded(b)
    const coach = typeof b.coach === 'object' ? b.coach?.displayName : ''
    out.push({
      kind: 'academy', id: b.id, reference: b.reference, category: b.kind === 'group' ? 'small-group' : 'one-on-one', at: b.createdAt, payee: 'academy',
      description: `${b.kind === 'group' ? 'Small group' : '1-on-1'}${b.packSize ? ` pack of ${b.packSize}` : b.type === 'term' ? ' (term)' : ''}${coach ? ` with ${coach}` : ''}`,
      player: name(b.player), family: name(b.contact) || b.contact?.email || '', email: b.contact?.email ?? '', account: idOf(b.account),
      paid, refunded, refundable: refundableLeft(paid, refunded), status: b.status,
      cancellable: ['confirmed', 'payment_failed'].includes(b.status),
      note: !paid ? 'Paid with session credits — nothing to refund to a card' : undefined,
    })
  }
  for (const o of od.docs as Order[]) {
    const paid = r2(o.total ?? 0)
    const refunded = lo.get(o.id) ?? (o.status === 'refunded' ? paid : 0)
    out.push({
      kind: 'order', id: o.id, reference: o.reference ?? '', category: 'shop', at: o.createdAt, payee: o.payee === 'club' ? 'club' : 'academy',
      description: `Shop: ${(o.items ?? []).map((i) => `${i.quantity && i.quantity > 1 ? `${i.quantity} × ` : ''}${i.name}`).join(', ')}`.slice(0, 120),
      player: '', family: o.contact?.name ?? '', email: o.contact?.email ?? '', account: idOf(o.account),
      paid, refunded, refundable: refundableLeft(paid, refunded), status: o.status, cancellable: false,
    })
  }
  for (const i of iv.docs as Invoice[]) {
    const paid = r2(i.total ?? 0)
    const refunded = li.get(i.id) ?? (i.status === 'refunded' ? paid : 0)
    const card = i.paidVia === 'card'
    out.push({
      kind: 'invoice', id: i.id, reference: i.reference, category: 'invoices', at: i.paidAt ?? i.createdAt, payee: i.payee === 'club' ? 'club' : 'academy',
      description: `Invoice: ${(i.items ?? []).map((l) => l.description).join(', ')}`.slice(0, 120),
      player: i.playerName ?? '', family: i.contactName, email: i.contactEmail ?? '', account: idOf(i.account),
      paid, refunded, refundable: card ? refundableLeft(paid, refunded) : 0, status: i.status, cancellable: false,
      note: card ? undefined : `Paid another way (${i.paymentNote || 'cash / bank transfer'}) — give it back the same way`,
    })
  }
  return out.sort((a, b) => b.at.localeCompare(a.at))
}

/** Refund part of a Stripe Checkout payment (one checkout can cover several children). */
async function refundCheckout(payee: Payee, checkoutId: string | null | undefined, amount: number, key: string, reference: string) {
  if (paymentsMode(payee) === 'simulate') return { status: 'simulated' as const, ids: [] as string[] }
  if (!checkoutId) throw new RefundError('There’s no card payment on record for this — refund it in the Stripe dashboard.')
  const stripe = stripeFor(payee)
  const cs = await stripe.checkout.sessions.retrieve(checkoutId)
  const pi = typeof cs.payment_intent === 'string' ? cs.payment_intent : cs.payment_intent?.id
  if (!pi) throw new RefundError('Stripe has no payment for this checkout.')
  const refund = await stripe.refunds.create({ payment_intent: pi, amount: Math.round(amount * 100), reason: 'requested_by_customer', metadata: { reference, key } }, { idempotencyKey: `mgmt-refund-${key}` })
  return { status: 'refunded' as const, ids: [refund.id] }
}

export type RefundRequest = { kind: Kind; id: number; amount: number; reason: string; cancel: boolean; emailFamily: boolean; actorId: number; nonce: string }

/** Refund (part of) a payment to the card it came from, optionally cancelling the booking, and record it. */
export async function refundTransaction(p: Payload, r: RefundRequest) {
  if (!r.reason.trim()) throw new RefundError('Please give a reason — it’s kept with the refund.')
  if (!/^[\w-]{8,64}$/.test(r.nonce)) throw new RefundError('Please reload the page and try again.')
  // The same form can't refund twice (double click / back button)
  const dup = await p.find({ collection: 'refunds', where: { nonce: { equals: r.nonce } }, limit: 1, pagination: false, ...q })
  if (dup.docs[0]) return dup.docs[0]

  const txn = await loadTxn(p, r.kind, r.id)
  const problem = txn.note && !txn.refundable ? txn.note : checkAmount(r.amount, txn.refundable)
  if (problem) throw new RefundError(problem)
  const amount = r2(r.amount)
  const full = Math.round(amount * 100) === Math.round(txn.refundable * 100)

  let status: 'refunded' | 'simulated' = 'refunded'
  let ids: string[] = []
  let cancelled = false
  const base = { kind: r.kind, docId: r.id, reference: txn.reference, category: txn.category, payee: txn.payee, account: txn.account, description: txn.description, playerName: txn.player, amount, reason: r.reason.trim().slice(0, 1000), by: r.actorId, nonce: r.nonce }
  try {
    if (r.kind === 'academy') {
      const b = await p.findByID({ collection: 'academy-bookings', id: r.id, ...q })
      if (r.cancel && txn.cancellable) {
        // The usual cancellation (sessions, coach, weekly charges), with the refund amount chosen here
        const res = await cancelAcademy(p, { bookingId: r.id, cancel: 'booking', by: 'family', outcome: 'refund', overrideAmount: amount, reason: r.reason, actorId: r.actorId, notify: r.emailFamily })
        if (!res.ok) throw new RefundError(res.error)
        if (res.refund === 'failed') throw new RefundError('The booking was cancelled but Stripe refused the refund — retry it from Bookings & cancellations.')
        cancelled = true
        status = res.refund === 'simulated' ? 'simulated' : 'refunded'
      } else {
        const key = `${r.nonce}`
        const res = await refundToCard(b, amount, key)
        status = res.status
        ids = res.ids
        await p.update({ collection: 'academy-bookings', id: r.id, ...q, data: { adjustments: [...(b.adjustments ?? []), { key, action: 'goodwill', by: 'admin', outcome: 'refund', cash: amount, credit: 0, creditSessions: 0, refundStatus: status, rule: 'Refund from Management → Refunds', reason: r.reason, stripeRefundIds: ids.join(','), actor: r.actorId, at: new Date().toISOString() }] } })
      }
    } else {
      const doc = await p.findByID({ collection: r.kind === 'booking' ? 'bookings' : r.kind === 'order' ? 'orders' : 'invoices', id: r.id, ...q })
      const res = await refundCheckout(txn.payee, (doc as { stripeCheckoutId?: string | null }).stripeCheckoutId, amount, r.nonce, txn.reference)
      status = res.status
      ids = res.ids
      if (r.kind === 'booking' && r.cancel && txn.cancellable) {
        // 'refunded' = cancelled after payment (all or part given back); frees the place and regroups camps
        await p.update({ collection: 'bookings', id: r.id, ...q, data: { status: 'refunded' } })
        await p.update({ collection: 'academy-registrations', where: { booking: { equals: r.id }, status: { not_equals: 'cancelled' } }, ...q, data: { status: 'cancelled' } })
        cancelled = true
      } else if (full && (r.kind === 'order' || r.kind === 'invoice')) {
        await p.update({ collection: r.kind === 'order' ? 'orders' : 'invoices', id: r.id, ...q, data: { status: 'refunded' } })
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await p.create({ collection: 'refunds', ...q, data: { ...base, status: 'failed', error: msg.slice(0, 300), nonce: `${r.nonce}-failed-${Date.now()}` } })
    if (e instanceof RefundError) throw e
    p.logger.error({ err: e, msg: `Refund of ${txn.reference} failed` })
    throw new RefundError(`Stripe didn’t accept the refund: ${msg.slice(0, 200)}`)
  }
  const saved = await p.create({ collection: 'refunds', ...q, data: { ...base, status, cancelled, stripeRefundIds: ids.join(',') } })

  // The 1-on-1 cancellation emails the family itself
  if (r.emailFamily && txn.email && !(r.kind === 'academy' && cancelled)) {
    const brand = txn.payee === 'club' ? 'club' : 'academy'
    const html = emailLayout(brand, [{
      heading: 'Refund on its way',
      intro: `Hi ${esc(txn.family.split(' ')[0] || 'there')} — we’ve refunded ${esc(formatAUD(amount))} to the card you paid with${cancelled ? ' and cancelled the booking' : ''}. It usually shows on your statement within 5–10 business days.`,
      rows: [['For', txn.description], ...(txn.player ? ([['Player', txn.player]] as [string, string][]) : []), ['Refunded', formatAUD(amount)], ['Reference', txn.reference]],
    }])
    await sendEmail(p, { to: txn.email, subject: `Refund of ${formatAUD(amount)} — ${txn.reference}`, html, sender: brand, userId: txn.account ?? undefined }).catch((e) => p.logger.error({ err: e, msg: `Refund email for ${txn.reference} failed` }))
  }
  return saved
}

/** One payment by kind and id, as the page shows it. */
export async function loadTxn(p: Payload, kind: Kind, id: number): Promise<Txn> {
  const coll = { booking: 'bookings', academy: 'academy-bookings', order: 'orders', invoice: 'invoices' } as const
  const doc = await p.findByID({ collection: coll[kind], id, depth: 0, overrideAccess: true, disableErrors: true })
  if (!doc) throw new RefundError('That payment no longer exists.')
  const ref = (doc as { reference?: string | null }).reference
  if (!ref) throw new RefundError('That payment has no reference.')
  const found = (await searchTransactions(p, ref)).find((t) => t.kind === kind && t.id === id)
  if (!found) throw new RefundError('That payment can’t be refunded (it isn’t paid).')
  return found
}

/** Recent refunds, newest first. */
export async function recentRefunds(p: Payload, limit = 30) {
  return (await p.find({ collection: 'refunds', sort: '-createdAt', limit, pagination: false, depth: 1, overrideAccess: true })).docs
}
