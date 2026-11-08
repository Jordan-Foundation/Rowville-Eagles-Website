import type { Payload } from 'payload'
import type { AcademyCoach, AcademyRegistration, AcademyTermSlot, Program } from '@/payload-types'
import { slotLabel, slotSessions, yearsLabel, type GroupSession } from './slots'

const rel = (v: number | { id: number } | null | undefined) => (v && typeof v === 'object' ? v.id : (v ?? null))
const ids = (v: (number | AcademyCoach)[] | null | undefined) => (v ?? []).map((c) => (typeof c === 'object' ? c.id : c))

export type CoachGroup = {
  key: string
  program: Program
  slot: AcademyTermSlot
  title: string
  groupName: string | null
  sessions: GroupSession[]
  players: AcademyRegistration[]
}

/** The training times / groups a coach runs (open programs), with their paid players. */
export async function coachGroups(payload: Payload, coachId: number): Promise<CoachGroup[]> {
  const { docs: slots } = await payload.find({
    collection: 'academy-term-slots',
    where: { or: [{ coaches: { in: [coachId] } }, { 'groups.coaches': { in: [coachId] } }] },
    limit: 100,
    depth: 1,
    overrideAccess: true,
  })
  const out: CoachGroup[] = []
  for (const slot of slots) {
    const program = slot.program as Program
    if (!program || typeof program !== 'object' || program.status === 'closed') continue
    const whole = ids(slot.coaches as never).includes(coachId)
    const mine = (slot.groups ?? []).filter((g) => ids(g.coaches as never).includes(coachId))
    const { docs: players } = await payload.find({ collection: 'academy-registrations', where: { slot: { equals: slot.id }, status: { equals: 'paid' } }, sort: 'player.firstName', limit: 500, depth: 0, overrideAccess: true })
    const sessions = slotSessions(slot, program)
    const base = { program, slot: { ...slot, program: rel(slot.program as never)! } as AcademyTermSlot, sessions }
    if (whole) out.push({ ...base, key: String(slot.id), title: `${slotLabel(slot)} · ${program.type === 'toddler' ? `${program.title} · Ages 2–5` : yearsLabel(slot.birthYears)}`, groupName: null, players })
    else for (const g of mine) out.push({ ...base, key: `${slot.id}:${g.id}`, title: `${g.name} · ${slotLabel(slot)}`, groupName: g.name, players: players.filter((p) => p.groupId === g.id) })
  }
  return out.sort((a, b) => (a.sessions.find((s) => !s.cancelled && new Date(s.endsAt) > new Date())?.startsAt ?? 'z').localeCompare(b.sessions.find((s) => !s.cancelled && new Date(s.endsAt) > new Date())?.startsAt ?? 'z'))
}

export const nextSession = (g: CoachGroup, now = new Date()) => g.sessions.find((s) => !s.cancelled && new Date(s.endsAt) > now)
