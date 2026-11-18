import type { Payload } from 'payload'
import { HEARD_FROM } from '../tracking/heard'
import { groupLabel } from './age-groups'

/**
 * The audience: everyone the club holds contact details for — EOIs and trials (Eagles and Academy), bookings, camps,
 * term registrations, shop orders, the Foundation+ waitlist and family accounts — merged into one row per family
 * (by email). For Management only. Marketing permission comes from the family's own choices (account preferences,
 * or the opt-in box at checkout); a trial or EOI on its own only allows messages about that trial.
 */

export const SOURCES = {
  'eagles-eoi': 'Eagles EOI (waiting for trial)',
  'eagles-trial': 'Eagles trial booked',
  'eagles-player': 'Eagles offer / registered',
  tournament: 'Tournament interest',
  'academy-trial': 'Academy free trial',
  'academy-term': 'Academy term',
  '1on1': '1-on-1 / small group',
  camp: 'Holiday camp',
  program: 'Other program booking',
  shop: 'Shop order',
  fplus: 'Foundation+ waitlist',
  account: 'Family account',
  import: 'Imported (old form)',
} as const
export type Source = keyof typeof SOURCES

export type Contact = {
  email: string
  name: string
  phone: string
  sources: Source[]
  heardFrom: string[]
  players: { name: string; birthYear: number | null }[]
  firstSeen: string
  lastSeen: string
  account: boolean
  marketingEmail: boolean
  marketingSms: boolean
}

type Draft = Omit<Contact, 'sources' | 'heardFrom' | 'players'> & { sources: Set<Source>; heardFrom: Set<string>; players: Map<string, number | null> }

const q = { pagination: false, limit: 20000, depth: 0, overrideAccess: true } as const
const yearOf = (dob?: string | null) => (dob ? Number(dob.slice(0, 4)) || null : null)

/** Every contact, newest activity first. */
export async function loadAudience(p: Payload): Promise<Contact[]> {
  const [users, entries, bookings, academy, regs, orders, waitlist, programs] = await Promise.all([
    p.find({ ...q, collection: 'users', select: { email: true, firstName: true, lastName: true, phone: true, roles: true, marketingEmail: true, marketingSms: true, createdAt: true } }),
    p.find({ ...q, collection: 'selection-entries', select: { kind: true, status: true, source: true, heardFrom: true, contact: true, player: true, birthYear: true, createdAt: true } }),
    p.find({ ...q, collection: 'bookings', where: { status: { in: ['paid', 'refunded', 'waitlisted', 'cancelled'] } }, select: { program: true, bookingType: true, heardFrom: true, contact: true, player: true, birthYear: true, createdAt: true } }),
    p.find({ ...q, collection: 'academy-bookings', where: { status: { not_in: ['held', 'expired'] } }, select: { heardFrom: true, marketingOptIn: true, contact: true, player: true, createdAt: true } }),
    p.find({ ...q, collection: 'academy-registrations', where: { status: { not_equals: 'cancelled' } }, select: { contact: true, player: true, createdAt: true } }),
    p.find({ ...q, collection: 'orders', where: { status: { not_in: ['pending', 'cancelled'] } }, select: { contact: true, createdAt: true } }),
    p.find({ ...q, collection: 'fplus-waitlist', select: { email: true, createdAt: true } }),
    p.find({ ...q, collection: 'programs', select: { type: true } }),
  ])
  const programType = new Map(programs.docs.map((x) => [x.id, x.type]))
  const by = new Map<string, Draft>()
  const touch = (email: string | null | undefined, at: string, o: { name?: string; phone?: string | null; source: Source; heard?: string | null; player?: { firstName?: string | null; lastName?: string | null; dateOfBirth?: string | null } | null; birthYear?: number | null }) => {
    const key = (email ?? '').trim().toLowerCase()
    if (!key.includes('@')) return null
    let c = by.get(key)
    if (!c) {
      c = { email: key, name: '', phone: '', sources: new Set(), heardFrom: new Set(), players: new Map(), firstSeen: at, lastSeen: at, account: false, marketingEmail: false, marketingSms: false }
      by.set(key, c)
    }
    if (o.name?.trim() && !c.name) c.name = o.name.trim()
    if (o.phone?.trim() && !c.phone) c.phone = o.phone.trim()
    c.sources.add(o.source)
    if (o.heard) c.heardFrom.add(o.heard)
    const pn = [o.player?.firstName, o.player?.lastName].filter(Boolean).join(' ').trim()
    if (pn) c.players.set(pn.toLowerCase(), c.players.get(pn.toLowerCase()) ?? o.birthYear ?? yearOf(o.player?.dateOfBirth))
    if (at < c.firstSeen) c.firstSeen = at
    if (at > c.lastSeen) c.lastSeen = at
    return c
  }
  const nm = (x?: { firstName?: string | null; lastName?: string | null } | null) => [x?.firstName, x?.lastName].filter(Boolean).join(' ')

  for (const u of users.docs) {
    const roles = u.roles ?? []
    if (!roles.some((r) => r === 'parent' || r === 'player')) continue // staff-only accounts aren't audience
    const c = touch(u.email, u.createdAt, { name: nm(u), phone: u.phone, source: 'account' })
    if (c) Object.assign(c, { account: true, marketingEmail: c.marketingEmail || Boolean(u.marketingEmail), marketingSms: c.marketingSms || Boolean(u.marketingSms) })
  }
  for (const e of entries.docs) {
    const source: Source = e.kind === 'tournament' ? 'tournament' : e.status === 'interested' ? 'eagles-eoi' : ['offered', 'registered', 'selected'].includes(e.status ?? '') ? 'eagles-player' : 'eagles-trial'
    const c = touch(e.contact?.email, e.createdAt, { name: nm(e.contact), phone: e.contact?.phone, source, heard: e.heardFrom, player: e.player, birthYear: e.birthYear })
    if (c && e.source === 'import') c.sources.add('import')
  }
  for (const b of bookings.docs) {
    const type = programType.get(typeof b.program === 'object' ? b.program.id : b.program)
    const source: Source = b.bookingType === 'trial' ? 'academy-trial' : type === 'holiday-camp' ? 'camp' : 'program'
    touch(b.contact?.email, b.createdAt, { name: nm(b.contact), phone: b.contact?.phone, source, heard: b.heardFrom, player: b.player, birthYear: b.birthYear })
  }
  for (const b of academy.docs) {
    const c = touch(b.contact?.email, b.createdAt, { name: nm(b.contact), phone: b.contact?.mobile, source: '1on1', heard: b.heardFrom, player: b.player })
    if (c && b.marketingOptIn) c.marketingEmail = true
  }
  for (const r of regs.docs) touch(r.contact?.email, r.createdAt, { name: nm(r.contact), phone: r.contact?.phone, source: 'academy-term', player: r.player })
  for (const o of orders.docs) touch(o.contact?.email, o.createdAt, { name: nm(o.contact as { firstName?: string; lastName?: string }), phone: o.contact?.phone, source: 'shop' })
  for (const w of waitlist.docs) touch(w.email, w.createdAt, { source: 'fplus' })

  return [...by.values()]
    .map((c) => ({ ...c, sources: [...c.sources], heardFrom: [...c.heardFrom], players: [...c.players].map(([k, birthYear]) => ({ name: k.replace(/\b\w/g, (m) => m.toUpperCase()), birthYear })) }))
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
}

/** Pure: does a contact match the search text and filters (unit tested)? */
export function matches(c: Contact, f: { q?: string; source?: string; optedIn?: boolean }) {
  if (f.source && !c.sources.includes(f.source as Source)) return false
  if (f.optedIn && !c.marketingEmail && !c.marketingSms) return false
  const text = (f.q ?? '').trim().toLowerCase()
  if (!text) return true
  const digits = text.replace(/\D/g, '')
  return [c.email, c.name, ...c.players.map((x) => x.name)].some((s) => s.toLowerCase().includes(text)) || (digits.length >= 4 && c.phone.replace(/\D/g, '').includes(digits))
}

/** Pure: the overview numbers (unit tested). */
export function summarise(all: Contact[], now = new Date()) {
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString()
  const count = <K extends string>(keys: K[]) => {
    const m = new Map<K, number>()
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1)
    return m
  }
  const bySource = count(all.flatMap((c) => c.sources))
  const heard = count(all.flatMap((c) => (c.heardFrom.length ? c.heardFrom : [''])))
  const groups = count(all.flatMap((c) => c.players.filter((x) => x.birthYear).map((x) => groupLabel(x.birthYear!))))
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1))
    return d.toISOString().slice(0, 7)
  })
  const newByMonth = count(all.map((c) => c.firstSeen.slice(0, 7)))
  return {
    total: all.length,
    new30: all.filter((c) => c.firstSeen >= since).length,
    marketingEmail: all.filter((c) => c.marketingEmail).length,
    marketingSms: all.filter((c) => c.marketingSms).length,
    accounts: all.filter((c) => c.account).length,
    players: all.reduce((n, c) => n + c.players.length, 0),
    sources: (Object.keys(SOURCES) as Source[]).map((k) => ({ key: k, label: SOURCES[k], count: bySource.get(k) ?? 0 })).filter((x) => x.count),
    heard: [...HEARD_FROM.map((o) => ({ key: o.value as string, label: o.label })), { key: '', label: 'Not asked / not answered' }].map((o) => ({ ...o, count: heard.get(o.key) ?? 0 })).filter((x) => x.count),
    groups: [...groups].map(([label, n]) => ({ label, count: n })).sort((a, b) => b.count - a.count),
    months: months.map((m) => ({ month: m, count: newByMonth.get(m) ?? 0 })),
  }
}
