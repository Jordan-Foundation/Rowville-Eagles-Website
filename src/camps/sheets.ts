import type { Payload } from 'payload'
import type { Booking, Program, User } from '../payload-types'
import { isManagementRoles } from '../lib/home'
import { formatPhone } from '../lib/phone'
import { loadCampGroups } from './groups'

const q = { overrideAccess: true, depth: 0 } as const

/**
 * Who can see a camp's attendance and emergency sheets: Management, and coaches confirmed for that camp.
 * (Parents and other coaches can't — the sheets hold every family's contact and medical details.)
 */
export async function canSeeCampSheets(p: Payload, user: User | null, campId: number) {
  if (!user) return false
  if (isManagementRoles(user.roles)) return true
  const { docs: coach } = await p.find({ pagination: false, collection: 'academy-coaches', where: { user: { equals: user.id } }, limit: 1, ...q })
  if (!coach[0]) return false
  const { totalDocs } = await p.count({ collection: 'camp-coaches', where: { program: { equals: campId }, coach: { equals: coach[0].id }, status: { equals: 'confirmed' } }, overrideAccess: true })
  return totalDocs > 0
}

export type SheetKid = {
  name: string
  age: number | null
  dob: string
  parent: string
  mobile: string
  email: string
  emergencyName: string
  emergencyRelationship: string
  emergencyPhone: string
  medical: string
  hasMedical: boolean
  photoConsent: boolean
  days: string[]
}

const toKid = (b: Booking, age: number | null, days: string[]): SheetKid => {
  const medical = (b.player?.medical ?? '').trim()
  return {
    name: `${b.player?.firstName ?? ''} ${b.player?.lastName ?? ''}`.trim(),
    age,
    dob: b.player?.dateOfBirth?.slice(0, 10) ?? '',
    parent: `${b.contact.firstName} ${b.contact.lastName}`.trim(),
    mobile: b.contact.phone ? formatPhone(b.contact.phone) : '',
    email: b.contact.email,
    emergencyName: b.player?.emergencyName ?? '',
    emergencyRelationship: b.player?.emergencyRelationship ?? '',
    emergencyPhone: b.player?.emergencyPhone ? formatPhone(b.player.emergencyPhone) : '',
    medical: medical || 'Not given',
    hasMedical: !!medical && !/^none\.?$/i.test(medical),
    photoConsent: !!b.player?.photoConsent,
    days,
  }
}

const byName = (a: SheetKid, b: SheetKid) => a.name.localeCompare(b.name)

/** Everything for the sheets: each group's children with their contact and medical details, and the day-by-day groups. */
export async function loadCampSheets(p: Payload, camp: Program) {
  const data = await loadCampGroups(p, camp)
  const ids = data.groups.flatMap((g) => g.kids.map((k) => k.bookingId))
  const { docs: bookings } = ids.length ? await p.find({ pagination: false, collection: 'bookings', where: { id: { in: ids } }, limit: ids.length, ...q }) : { docs: [] as Booking[] }
  const byId = new Map(bookings.map((b) => [b.id, b]))
  const groups = data.groups.map((g) => ({
    n: g.n,
    label: g.label,
    kids: g.kids.map((k) => byId.get(k.bookingId) && toKid(byId.get(k.bookingId)!, k.age, k.days)).filter((k): k is SheetKid => !!k).sort(byName),
  }))
  /** The groups as they run on one day (a small group joins its neighbour), with only that day's children. */
  const forDay = (date: string) =>
    (data.perDay.find((d) => d.date === date)?.groups ?? []).map((set) => {
      const kids = groups.filter((g) => set.groups.includes(g.n)).flatMap((g) => g.kids).filter((k) => k.days.includes(date)).sort(byName)
      const ages = kids.map((k) => k.age).filter((a): a is number => a != null)
      return { label: set.label, ages, kids }
    })
  return { days: data.days, groups, forDay, children: data.children }
}
