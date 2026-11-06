import { localToUtc } from '../lib/time'
import { termDatesForWeekday, isAway, type TermShape } from './term-dates'
import type { Weekday } from './constants'

export type CoachAvailability = {
  coachId: number
  slots: { weekday: Weekday; startTime: string }[]
  away: { from: string; to: string }[]
}

export type CasualSlot = {
  /** UTC ISO start */
  startsAt: string
  /** Sydney calendar date YYYY-MM-DD */
  date: string
  /** "HH:MM" local */
  time: string
  coachIds: number[]
}

const takenKey = (coachId: number, startsAt: string | Date) => `${coachId}|${new Date(startsAt).toISOString()}`

/**
 * Every open casual (one-off) slot in a term, grouped by start time with the coaches free at that time.
 * A coach is free when: the time is in their weekly availability, they're not away that day, it's more than
 * `cutoffHours` from now, and no live session (scheduled or held) already uses that coach + time.
 */
export function casualSlots(opts: {
  term: TermShape
  coaches: CoachAvailability[]
  taken: { coachId: number; startsAt: string }[]
  now: Date
  cutoffHours: number
}): CasualSlot[] {
  const earliest = opts.now.getTime() + opts.cutoffHours * 3600 * 1000
  const takenSet = new Set(opts.taken.map((t) => takenKey(t.coachId, t.startsAt)))
  const byStart = new Map<string, CasualSlot>()
  for (const c of opts.coaches) {
    for (const s of c.slots) {
      for (const date of termDatesForWeekday(opts.term, s.weekday)) {
        if (isAway(date, c.away)) continue
        const start = localToUtc(date, s.startTime)
        if (start.getTime() <= earliest) continue
        const iso = start.toISOString()
        if (takenSet.has(takenKey(c.coachId, iso))) continue
        const slot = byStart.get(iso) ?? { startsAt: iso, date, time: s.startTime, coachIds: [] }
        if (!slot.coachIds.includes(c.coachId)) slot.coachIds.push(c.coachId)
        byStart.set(iso, slot)
      }
    }
  }
  return [...byStart.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

/** Is this exact coach + start time bookable as a casual session right now? */
export function isCasualOpen(opts: Parameters<typeof casualSlots>[0] & { coachId: number; startsAt: string }) {
  const iso = new Date(opts.startsAt).toISOString()
  return casualSlots(opts).some((s) => s.startsAt === iso && s.coachIds.includes(opts.coachId))
}
