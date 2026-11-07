import type { Payload } from 'payload'
import type { AcademyCoach, AcademyRegistration, AcademyTermSlot, Program } from '@/payload-types'
import { placementLabel, type AgeRules } from '../../lib/age-groups'
import { coachClashes, type Busy } from './clashes'
import { slotLabel, slotSessions, yearsLabel } from './slots'

const rel = (v: number | { id: number } | null | undefined) => (v && typeof v === 'object' ? v.id : (v ?? null))
const ids = (v: (number | AcademyCoach)[] | null | undefined) => (v ?? []).map((c) => (typeof c === 'object' ? c.id : c))

export const STATUS_LABEL: Record<AcademyRegistration['status'], string> = { interest: 'Interest', offered: 'Offered', pending_payment: 'Not paid yet', paid: 'Paid', cancelled: 'Cancelled' }

/** Coaches on a slot: the whole-slot coaches plus a group's coaches. */
export function coachesFor(slot: AcademyTermSlot, groupId?: string | null) {
  const g = groupId ? slot.groups?.find((x) => x.id === groupId) : null
  return [...new Set([...ids(slot.coaches as never), ...(g ? ids(g.coaches as never) : [])])]
}

/** Every coach assignment across open Academy term programs: what each coach is doing, and when. */
async function assignments(payload: Payload) {
  const { docs: programs } = await payload.find({ collection: 'programs', where: { type: { equals: 'academy-term' }, status: { not_equals: 'closed' } }, limit: 50, depth: 0, overrideAccess: true })
  const byId = new Map(programs.map((p) => [p.id, p]))
  const { docs: slots } = await payload.find({ collection: 'academy-term-slots', where: { program: { in: programs.map((p) => p.id) } }, limit: 500, depth: 0, overrideAccess: true })
  const out: { coach: number; slotId: number; groupId: string | null; label: string; sessions: ReturnType<typeof slotSessions> }[] = []
  for (const s of slots) {
    const program = byId.get(rel(s.program)!)!
    const sessions = slotSessions(s, program)
    for (const c of ids(s.coaches as never)) out.push({ coach: c, slotId: s.id, groupId: null, label: `${slotLabel(s)} (${yearsLabel(s.birthYears)})`, sessions })
    for (const g of s.groups ?? []) for (const c of ids(g.coaches as never)) out.push({ coach: c, slotId: s.id, groupId: g.id ?? null, label: `${g.name}, ${slotLabel(s)}`, sessions })
  }
  return out
}

/**
 * Clash warnings for every coach on every slot/group of this program, keyed "slotId" or "slotId:groupId".
 * Overlapping training times elsewhere, 1-on-1s at the same time, and away dates.
 */
export async function clashMap(payload: Payload, program: Program, slots: AcademyTermSlot[], coachName: Map<number, string>) {
  const all = await assignments(payload)
  const coachIds = [...new Set(all.filter((a) => slots.some((s) => s.id === a.slotId)).map((a) => a.coach))]
  const out = new Map<string, string[]>()
  if (!coachIds.length) return out
  const from = program.startDate ?? new Date().toISOString()
  const to = program.endDate ?? new Date(Date.now() + 120 * 86_400_000).toISOString()
  const [{ docs: oneOnOnes }, { docs: avail }] = await Promise.all([
    payload.find({ collection: 'academy-sessions', where: { coach: { in: coachIds }, status: { in: ['held', 'scheduled'] }, startsAt: { greater_than_equal: from, less_than_equal: to } }, limit: 5000, depth: 0, overrideAccess: true, select: { coach: true, startsAt: true } }),
    payload.find({ collection: 'academy-availability', where: { coach: { in: coachIds } }, limit: 500, depth: 0, overrideAccess: true, select: { coach: true, awayPeriods: true } }),
  ])
  for (const slot of slots) {
    const keys: [string, string | null][] = [[String(slot.id), null], ...(slot.groups ?? []).map((g) => [`${slot.id}:${g.id}`, g.id ?? null] as [string, string | null])]
    const sessions = slotSessions(slot, program)
    for (const [key, groupId] of keys) {
      const here = groupId ? ids(slot.groups!.find((g) => g.id === groupId)!.coaches as never) : ids(slot.coaches as never)
      const warnings: string[] = []
      for (const c of here) {
        // Elsewhere = any other slot, or another group of this slot (not the whole-slot role it shares)
        const busy: Busy[] = all
          .filter((a) => a.coach === c && !(a.slotId === slot.id && (a.groupId === groupId || a.groupId === null || groupId === null)))
          .flatMap((a) => a.sessions.filter((s) => !s.cancelled).map((s) => ({ label: a.label, startsAt: s.startsAt, endsAt: s.endsAt })))
        for (const o of oneOnOnes) if (rel(o.coach as never) === c) busy.push({ label: 'a 1-on-1', startsAt: o.startsAt, endsAt: new Date(new Date(o.startsAt).getTime() + 3_600_000).toISOString() })
        const away = avail.filter((a) => rel(a.coach as never) === c).flatMap((a) => a.awayPeriods ?? [])
        warnings.push(...coachClashes({ coach: coachName.get(c) ?? 'Coach', sessions, busy, away }))
      }
      if (warnings.length) out.set(key, warnings)
    }
  }
  return out
}

/** Rows for the players board / CSV. */
export function boardRows(regs: AcademyRegistration[], slots: AcademyTermSlot[], rules: AgeRules) {
  const slotById = new Map(slots.map((s) => [s.id, s]))
  return regs.map((r) => {
    const slot = r.slot ? slotById.get(rel(r.slot as never)!) : undefined
    const group = slot?.groups?.find((g) => g.id === r.groupId)
    return {
      id: r.id,
      name: `${r.player.firstName} ${r.player.lastName}`,
      reference: r.reference ?? '',
      birthYear: r.birthYear ?? 0,
      playing: r.playingBirthYear ?? null,
      placement: r.birthYear ? placementLabel(r.birthYear, r.playingBirthYear, rules) : '',
      slotId: slot?.id ?? null,
      slotLabel: slot ? slotLabel(slot) : '',
      groupId: group?.id ?? null,
      groupName: group?.name ?? null,
      status: r.status,
      statusLabel: STATUS_LABEL[r.status],
      parent: `${r.contact.firstName} ${r.contact.lastName}`,
      phone: r.contact.phone,
      email: r.contact.email,
      medical: Boolean(r.player.medical?.trim()),
      medicalText: r.player.medical ?? '',
      emergency: [r.player.emergencyName, r.player.emergencyPhone].filter(Boolean).join(' '),
      moves: (r.moves ?? []).map((m) => ({ from: m.from, to: m.to, reason: m.reason })),
      coachIds: slot ? coachesFor(slot, r.groupId) : [],
    }
  })
}
