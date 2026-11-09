import type { Payload, Where } from 'payload'
import { birthYearOf } from './age-groups'
import { formatPhone } from './phone'
import { toE164 } from './sms'

const q = { overrideAccess: true, pagination: false } as const

export type Hit = { kind: 'family' | 'player' | 'booking'; href: string; title: string; detail: string }

/** Management search: a family (name, email, mobile), a player (name) or anything with a reference (RFA-…, REFC-…). */
export async function managementSearch(p: Payload, raw: string): Promise<Hit[]> {
  const term = raw.trim().slice(0, 100)
  if (term.length < 2) return []
  const hits: Hit[] = []
  const words = term.split(/\s+/).filter(Boolean)
  const phone = toE164(term.replace(/\s/g, ''))
  const digits = term.replace(/\D/g, '')

  // Families
  const userOr: Where[] = [{ email: { like: term.toLowerCase() } }]
  if (phone) userOr.push({ phoneE164: { equals: phone } })
  if (digits.length >= 6) userOr.push({ phone: { like: digits.slice(-6) } })
  if (words.length >= 2) userOr.push({ and: [{ firstName: { like: words[0] } }, { lastName: { like: words.slice(1).join(' ') } }] })
  else userOr.push({ firstName: { like: term } }, { lastName: { like: term } })
  const { docs: users } = await p.find({ ...q, collection: 'users', where: { or: userOr }, limit: 25, depth: 0, sort: 'firstName' })
  for (const u of users) hits.push({ kind: 'family', href: `/management/families/${u.id}`, title: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email, detail: [u.email, u.phone && formatPhone(u.phone), (u.roles ?? []).filter((r) => r !== 'parent').join(', ')].filter(Boolean).join(' · ') })

  // Players
  if (!/\d{3,}|@/.test(term)) {
    const kidWhere: Where = words.length >= 2 ? { and: [{ firstName: { like: words[0] } }, { lastName: { like: words.slice(1).join(' ') } }] } : { or: [{ firstName: { like: term } }, { lastName: { like: term } }] }
    const { docs: kids } = await p.find({ ...q, collection: 'participants', where: kidWhere, limit: 25, depth: 1, sort: 'firstName' })
    for (const k of kids) {
      const parent = typeof k.account === 'object' ? k.account : null
      hits.push({ kind: 'player', href: `/management/players/${k.id}`, title: `${k.firstName} ${k.lastName}`, detail: [birthYearOf(k.dateOfBirth) && `born ${birthYearOf(k.dateOfBirth)}`, parent && `parent ${[parent.firstName, parent.lastName].filter(Boolean).join(' ') || parent.email}`].filter(Boolean).join(' · ') })
    }
  }

  // References
  if (/^[a-z]{2,4}-?[a-z0-9]{3,}$/i.test(term)) {
    const ref = term.toUpperCase()
    const [ab, b, o, r, s] = await Promise.all([
      p.find({ ...q, collection: 'academy-bookings', where: { reference: { like: ref } }, limit: 10, depth: 0 }),
      p.find({ ...q, collection: 'bookings', where: { reference: { like: ref } }, limit: 10, depth: 1 }),
      p.find({ ...q, collection: 'orders', where: { reference: { like: ref } }, limit: 10, depth: 0 }),
      p.find({ ...q, collection: 'academy-registrations', where: { reference: { like: ref } }, limit: 10, depth: 1 }),
      p.find({ ...q, collection: 'selection-entries', where: { reference: { like: ref } }, limit: 10, depth: 0 }),
    ])
    for (const x of ab.docs) hits.push({ kind: 'booking', href: `/management/academy/bookings/${x.id}`, title: `${x.reference} · 1-on-1`, detail: `${x.player.firstName} ${x.player.lastName} · ${x.status}` })
    for (const x of b.docs) hits.push({ kind: 'booking', href: `/admin/collections/bookings/${x.id}`, title: `${x.reference} · ${typeof x.program === 'object' ? x.program.title : 'Booking'}`, detail: `${x.player?.firstName ?? x.player?.teamName ?? ''} · ${x.status}` })
    for (const x of o.docs) hits.push({ kind: 'booking', href: `/admin/collections/orders/${x.id}`, title: `${x.reference} · Shop order`, detail: `${x.contact?.name ?? ''} · ${x.status}` })
    for (const x of r.docs) hits.push({ kind: 'booking', href: `/management/academy/terms`, title: `${x.reference} · ${typeof x.program === 'object' ? x.program.title : 'Academy term'}`, detail: `${x.player.firstName} ${x.player.lastName} · ${x.status}` })
    for (const x of s.docs) hits.push({ kind: 'booking', href: `/management/selections`, title: `${x.reference} · Selection`, detail: `${x.status}` })
  }
  return hits
}
