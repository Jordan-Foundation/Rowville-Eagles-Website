import type { CollectionAfterChangeHook, CollectionConfig, Payload, PayloadRequest } from 'payload'
import { formatAUD } from '../lib/format'
import { TZ } from '../lib/time'
import { became, isSoon } from './rules'
import { record } from './service'

/**
 * Turns changes in the database into Management notifications, in one place (no need to touch every checkout).
 * Each rule fires once, when a status *changes* to the value it watches.
 */

type Doc = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const id = (v: unknown): number | null => (v && typeof v === 'object' ? ((v as { id?: number }).id ?? null) : typeof v === 'number' ? v : null)
const when = (iso?: string | null) => (iso ? new Intl.DateTimeFormat('en-AU', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : '')
const name = (x?: { firstName?: string | null; lastName?: string | null } | null) => [x?.firstName, x?.lastName].filter(Boolean).join(' ')
const money = (n?: number | null) => (typeof n === 'number' ? formatAUD(n) : '')

async function title(p: Payload, collection: 'programs' | 'academy-coaches', v: unknown, req: PayloadRequest) {
  const i = id(v)
  if (!i) return ''
  const d = (await p.findByID({ collection, id: i, depth: 0, overrideAccess: true, req, disableErrors: true })) as Doc | null
  return String(d?.title ?? d?.displayName ?? '')
}

const RULES: Record<string, (a: { doc: Doc; prev: Doc | null; op: string; p: Payload; req: PayloadRequest }) => Promise<void>> = {
  // Programs: camps, Mini Ballers, Eagles registrations, RFA trial nights
  bookings: async ({ doc, prev, p, req }) => {
    const prog = await title(p, 'programs', doc.program, req)
    const who = name(doc.player) || name(doc.contact)
    const href = `/admin/collections/bookings/${doc.id}`
    if (became(prev, doc, 'paid')) {
      if (doc.bookingType === 'trial') await record(p, `bookings:${doc.id}:trial`, { kind: 'trial', urgent: true, title: `RFA trial booked: ${who}`, detail: [prog, when(doc.sessionStart), doc.contact?.phone].filter(Boolean).join(' · '), href }, req)
      else await record(p, `bookings:${doc.id}:paid`, { kind: 'payment', title: `${prog || 'Booking'} paid: ${who}`, detail: [money(doc.amount), doc.reference].filter(Boolean).join(' · '), href }, req)
    }
    if (became(prev, doc, ['cancelled', 'refunded']) && prev?.status === 'paid') await record(p, `bookings:${doc.id}:${doc.status}`, { kind: 'problem', title: `${prog || 'Booking'} ${doc.status}: ${who}`, detail: doc.reference, href }, req)
  },
  // 1-on-1s, small groups, holiday packs
  'academy-bookings': async ({ doc, prev, p, req }) => {
    const coach = await title(p, 'academy-coaches', doc.coach, req)
    const what = doc.packSize ? `Holiday pack (${doc.packSize})` : doc.kind === 'group' ? 'Small group' : doc.type === 'term' ? '1-on-1 term' : '1-on-1'
    const who = name(doc.player)
    const href = `/management/academy/bookings/${doc.id}`
    if (became(prev, doc, 'confirmed') && (!prev || prev.status === 'held' || !prev.status)) {
      await record(p, `academy-bookings:${doc.id}:confirmed`, { kind: 'booking', urgent: isSoon(doc.firstSessionAt), title: `${what} booked: ${who}`, detail: [coach && `with ${coach}`, doc.firstSessionAt && `first ${when(doc.firstSessionAt)}`, money(doc.amount)].filter(Boolean).join(' · '), href }, req)
    }
    if (became(prev, doc, 'payment_failed')) await record(p, `academy-bookings:${doc.id}:failed:${new Date().toISOString().slice(0, 10)}`, { kind: 'problem', title: `Payment failed: ${who}`, detail: [what, coach && `with ${coach}`, doc.reference].filter(Boolean).join(' · '), href }, req)
    if (became(prev, doc, 'cancelled')) await record(p, `academy-bookings:${doc.id}:cancelled`, { kind: 'problem', title: `${what} cancelled: ${who}`, detail: [coach && `with ${coach}`, doc.reference].filter(Boolean).join(' · '), href }, req)
  },
  // Single sessions: cancellations, moves, cover
  'academy-sessions': async ({ doc, prev, p, req }) => {
    if (!prev || doc.kind === 'group-slot') return
    const coach = await title(p, 'academy-coaches', doc.coach, req)
    const href = id(doc.booking) ? `/management/academy/bookings/${id(doc.booking)}` : '/management/academy'
    const soon = isSoon(doc.startsAt) || isSoon(prev.startsAt)
    if (became(prev, doc, 'cancelled') && prev.status === 'scheduled') {
      await record(p, `academy-sessions:${doc.id}:cancelled`, { kind: soon ? 'problem' : 'booking', urgent: soon, title: `Session cancelled${doc.cancelledBy ? ` by ${doc.cancelledBy}` : ''}`, detail: [when(doc.startsAt), coach && `with ${coach}`].filter(Boolean).join(' · '), href }, req)
    }
    if (doc.status === 'scheduled' && prev.status === 'scheduled' && prev.startsAt && doc.startsAt !== prev.startsAt) {
      await record(p, `academy-sessions:${doc.id}:moved:${doc.startsAt}`, { kind: 'booking', urgent: soon, title: 'Session moved', detail: [`${when(prev.startsAt)} → ${when(doc.startsAt)}`, coach && `with ${coach}`].filter(Boolean).join(' · '), href }, req)
    }
    if (doc.needsCover && !prev.needsCover && doc.status === 'scheduled') {
      await record(p, `academy-sessions:${doc.id}:cover:${doc.startsAt}`, { kind: 'problem', urgent: true, title: 'Cover needed', detail: [when(doc.startsAt), coach && `${coach} is away`].filter(Boolean).join(' · '), href: '/management/academy' }, req)
    }
  },
  // Academy term / full-year registrations
  'academy-registrations': async ({ doc, prev, p, req }) => {
    if (!became(prev, doc, 'paid')) return
    const prog = await title(p, 'programs', doc.program, req)
    await record(p, `academy-registrations:${doc.id}:paid`, { kind: 'payment', title: `Academy registration paid: ${doc.displayName ?? ''}`.trim(), detail: [prog, doc.reference].filter(Boolean).join(' · '), href: `/admin/collections/academy-registrations/${doc.id}` }, req)
  },
  orders: async ({ doc, prev, p, req }) => {
    if (!became(prev, doc, 'paid')) return
    await record(p, `orders:${doc.id}:paid`, { kind: 'payment', title: `Shop order paid: ${name(doc.contact) || doc.reference}`, detail: [money(doc.total), doc.reference].filter(Boolean).join(' · '), href: `/admin/collections/orders/${doc.id}` }, req)
  },
  invoices: async ({ doc, prev, p, req }) => {
    if (!became(prev, doc, 'paid')) return
    await record(p, `invoices:${doc.id}:paid`, { kind: 'payment', title: `Invoice paid: ${doc.reference}`, detail: [doc.contactName, money(doc.total)].filter(Boolean).join(' · '), href: '/management/invoices' }, req)
  },
  // Club trials / expressions of interest (Rowville) and tournament EOIs
  'selection-entries': async ({ doc, op, p, req }) => {
    if (op !== 'create') return
    const club = doc.kind !== 'tournament'
    await record(p, `selection-entries:${doc.id}:new`, { kind: 'trial', urgent: club, title: `${club ? 'Club trial sign-up' : 'Tournament interest'}: ${name(doc.player)}`, detail: [doc.birthYear && `born ${doc.birthYear}`, name(doc.contact), doc.contact?.phone].filter(Boolean).join(' · '), href: `/admin/collections/selection-entries/${doc.id}` }, req)
  },
  'fplus-waitlist': async ({ doc, op, p, req }) => {
    if (op !== 'create') return
    await record(p, `fplus-waitlist:${doc.id}:new`, { kind: 'enquiry', title: 'Foundation+ waitlist sign-up', detail: doc.email, href: '/management/programs?view=foundation-plus' }, req)
  },
  refunds: async ({ doc, op, p, req }) => {
    if (op !== 'create' || doc.status !== 'failed') return
    await record(p, `refunds:${doc.id}:failed`, { kind: 'problem', title: `Refund failed: ${doc.reference ?? ''}`.trim(), detail: [doc.playerName, money(doc.amount), doc.error].filter(Boolean).join(' · '), href: '/management/refunds' }, req)
  },
}

/** Adds the notification hook to the collections above. */
export function withStaffFeed(c: CollectionConfig): CollectionConfig {
  const rule = RULES[c.slug]
  if (!rule) return c
  const hook: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
    try {
      await rule({ doc, prev: operation === 'create' ? null : (previousDoc ?? null), op: operation, p: req.payload, req })
    } catch (e) {
      req.payload.logger.error({ err: e, msg: `Staff notification hook failed on ${c.slug}` })
    }
    return doc
  }
  return { ...c, hooks: { ...c.hooks, afterChange: [...(c.hooks?.afterChange ?? []), hook] } }
}
