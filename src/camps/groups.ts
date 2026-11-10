import type { Payload, PayloadRequest } from 'payload'
import type { Booking, Program } from '../payload-types'
import { ageOn } from '../lib/age-check'
import { campDayList, type CampDay } from '../lib/camps'
import { GROUP_RULES, dayGroups, groupLabelText, planCampGroups, type CampKid, type GroupRules } from '../lib/camp-groups'

const q = { overrideAccess: true, depth: 0 } as const
const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null))

export async function campGroupRules(p: Payload, req?: PayloadRequest): Promise<GroupRules> {
  const s = await p.findGlobal({ slug: 'academy-settings', ...q, req }).catch(() => null)
  const min = s?.camps?.groupMin ?? GROUP_RULES.min
  const max = Math.max(min, s?.camps?.groupMax ?? GROUP_RULES.max)
  return { min, max }
}

const kidName = (b: Booking) => `${b.player?.firstName ?? ''} ${b.player?.lastName ?? ''}`.trim() || b.reference || `Booking ${b.id}`
/** The days a booking comes (every day for a full camp, or a booking made before days existed). */
export const bookingDays = (b: Pick<Booking, 'fullCamp' | 'campDays'>, all: CampDay[]) =>
  b.fullCamp || !(b.campDays ?? []).length ? all.map((d) => d.date) : (b.campDays ?? []).map((d) => d.day).filter((d) => all.some((x) => x.date === d))

async function paidBookings(p: Payload, programId: number, req?: PayloadRequest) {
  const { docs } = await p.find({ pagination: false, collection: 'bookings', where: { program: { equals: programId }, status: { equals: 'paid' } }, limit: 2000, sort: 'createdAt', ...q, req })
  return docs
}

/**
 * Work the groups out again after a booking is paid, cancelled or changed. Children placed by hand stay put;
 * everyone else can move. Placements for bookings that are no longer paid are removed.
 */
export async function regroupCamp(p: Payload, programId: number, req?: PayloadRequest) {
  const [bookings, rules, { docs: placements }] = await Promise.all([
    paidBookings(p, programId, req),
    campGroupRules(p, req),
    p.find({ pagination: false, collection: 'camp-placements', where: { program: { equals: programId } }, limit: 2000, ...q, req }),
  ])
  const byBooking = new Map(placements.map((x) => [idOf(x.booking)!, x]))
  const live = new Set(bookings.map((b) => b.id))
  for (const x of placements) if (!live.has(idOf(x.booking)!)) await p.delete({ collection: 'camp-placements', id: x.id, ...q, req })
  const kids: CampKid[] = bookings.map((b) => ({
    id: b.id,
    name: kidName(b),
    dob: (b.player?.dateOfBirth ?? '2000-01-01').slice(0, 10),
    checkoutGroup: b.checkoutGroup,
    keepWith: b.keepWith,
    lockedGroup: byBooking.get(b.id)?.locked ? byBooking.get(b.id)!.group : null,
  }))
  const plan = planCampGroups(kids, rules)
  let changed = 0
  for (const b of bookings) {
    const group = plan.get(b.id)!
    const existing = byBooking.get(b.id)
    if (!existing) {
      await p.create({ collection: 'camp-placements', data: { program: programId, booking: b.id, name: kidName(b), group, locked: false }, ...q, req })
      changed++
    } else if (existing.group !== group || existing.name !== kidName(b)) {
      await p.update({ collection: 'camp-placements', id: existing.id, data: { group, name: kidName(b) }, ...q, req })
      changed++
    }
  }
  return { children: bookings.length, changed }
}

export type CampKidView = { placementId: number; bookingId: number; name: string; age: number | null; days: string[]; locked: boolean; keepWith: string | null; siblings: boolean; medical: boolean }
export type CampGroupView = { n: number; label: string; ages: number[]; kids: CampKidView[] }
export type CampDayView = { date: string; total: number; groups: { groups: number[]; kids: number; label: string }[] }

/** Everything the Management camp page shows: groups (with labels) and children per day. */
export async function loadCampGroups(p: Payload, program: Program) {
  const days = campDayList(program)
  const [bookings, rules, { docs: placements }] = await Promise.all([
    paidBookings(p, program.id),
    campGroupRules(p),
    p.find({ pagination: false, collection: 'camp-placements', where: { program: { equals: program.id } }, limit: 2000, ...q }),
  ])
  const byBooking = new Map(bookings.map((b) => [b.id, b]))
  const firstDay = days[0] ? new Date(`${days[0].date}T12:00:00Z`) : new Date()
  const checkoutSizes = new Map<string, number>()
  for (const b of bookings) if (b.checkoutGroup) checkoutSizes.set(b.checkoutGroup, (checkoutSizes.get(b.checkoutGroup) ?? 0) + 1)
  const groups = new Map<number, CampKidView[]>()
  for (const x of placements) {
    const b = byBooking.get(idOf(x.booking)!)
    if (!b) continue
    const dob = b.player?.dateOfBirth?.slice(0, 10)
    const kid: CampKidView = {
      placementId: x.id,
      bookingId: b.id,
      name: x.name,
      age: dob ? ageOn(dob, firstDay) : null,
      days: bookingDays(b, days),
      locked: !!x.locked,
      keepWith: b.keepWith ?? null,
      siblings: !!b.checkoutGroup && (checkoutSizes.get(b.checkoutGroup) ?? 0) > 1,
      medical: !!b.player?.medical && !/^none\.?$/i.test(b.player.medical.trim()),
    }
    groups.set(x.group, [...(groups.get(x.group) ?? []), kid])
  }
  const view: CampGroupView[] = [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([n, kids]) => {
      kids.sort((a, b) => (a.age ?? 0) - (b.age ?? 0) || a.name.localeCompare(b.name))
      const ages = kids.map((k) => k.age).filter((a): a is number => a != null)
      return { n, label: groupLabelText(n, ages, kids.length), ages, kids }
    })
  const perDay: CampDayView[] = days.map((d) => {
    const counts = new Map(view.map((g) => [g.n, g.kids.filter((k) => k.days.includes(d.date)).length]))
    const total = [...counts.values()].reduce((a, b) => a + b, 0)
    return {
      date: d.date,
      total,
      groups: dayGroups(counts, rules).map((gs) => ({ groups: gs, kids: gs.reduce((a, g) => a + (counts.get(g) ?? 0), 0), label: gs.length > 1 ? `Groups ${gs.join('+')} together` : `Group ${gs[0]}` })),
    }
  })
  const unplaced = bookings.filter((b) => !placements.some((x) => idOf(x.booking) === b.id)).length
  return { days, groups: view, perDay, rules, unplaced, children: bookings.length }
}

/** Management moved a child: they stay in that group from now on. */
export async function moveCampKid(p: Payload, o: { placementId: number; group: number; actorId: number }) {
  if (!Number.isInteger(o.group) || o.group < 1 || o.group > 30) throw new Error('Choose a group.')
  return p.update({ collection: 'camp-placements', id: o.placementId, data: { group: o.group, locked: true, movedBy: o.actorId, movedAt: new Date().toISOString() }, ...q })
}

/** Let the automatic grouping place this child again. */
export async function unlockCampKid(p: Payload, placementId: number) {
  const x = await p.update({ collection: 'camp-placements', id: placementId, data: { locked: false }, ...q })
  await regroupCamp(p, idOf(x.program)!)
}

/** Undo every hand placement and work the groups out from scratch. */
export async function resetCampGroups(p: Payload, programId: number) {
  await p.update({ collection: 'camp-placements', where: { program: { equals: programId } }, data: { locked: false }, ...q })
  return regroupCamp(p, programId)
}
