import { localToUtc } from '../lib/time'
import { termDatesForWeekday, isAway, type TermShape } from './term-dates'
import type { Weekday } from './constants'
import { touchesBooking, withinHours, type BackToBack, type BookingHours } from './hours'

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

/** Bookable hours (all callers) and the back-to-back rule (customer booking pages only). */
export type SlotRules = {
  /** Default bookable hours + closed dates; without it every availability time counts */
  hours?: BookingHours | null
  /** Back-to-back rule; leave out for Management and coaches */
  backToBack?: BackToBack | null
  /** Session length in minutes (default 60) */
  sessionMinutes?: number | null
}
const fits = (o: SlotRules, coachId: number, date: string, time: string, start: Date) => {
  const len = o.sessionMinutes ?? 60
  if (o.hours && !withinHours(date, time, len, o.hours)) return false
  if (o.backToBack && !touchesBooking(coachId, start, len, o.backToBack)) return false
  return true
}

/**
 * Every open casual (one-off) slot in a term, grouped by start time with the coaches free at that time.
 * A coach is free when: the time is in their weekly availability, they're not away that day, it's more than
 * `cutoffHours` from now, and no live session (scheduled or held) already uses that coach + time.
 */
export function casualSlots(opts: SlotRules & {
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
        if (!fits(opts, c.coachId, date, s.startTime, start)) continue
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

export type TermSlot = {
  weekday: Weekday
  /** "HH:MM" local */
  time: string
  /** UTC ISO starts of every remaining session (after the booking cut-off) */
  sessions: string[]
  coachIds: number[]
  /** For each coach: the remaining session dates (YYYY-MM-DD) they're away for — still bookable, cover arranged */
  awayDates: Record<number, string[]>
}

/**
 * Every open whole-term weekly slot: coach + weekday + time where ALL remaining sessions of the term are free.
 * Remaining = sessions more than `cutoffHours` away. Needs at least `minSessions` remaining.
 * Coach away days don't block a term booking — they're listed so the family is told and cover is arranged.
 * Closed dates are left out of the sessions; with the back-to-back rule every remaining date has to pass it.
 */
export function termSlots(opts: SlotRules & {
  term: TermShape
  coaches: CoachAvailability[]
  taken: { coachId: number; startsAt: string }[]
  now: Date
  cutoffHours: number
  minSessions: number
}): TermSlot[] {
  const earliest = opts.now.getTime() + opts.cutoffHours * 3600 * 1000
  const takenSet = new Set(opts.taken.map((t) => takenKey(t.coachId, t.startsAt)))
  const byKey = new Map<string, TermSlot>()
  for (const c of opts.coaches) {
    for (const s of c.slots) {
      const dates = termDatesForWeekday(opts.term, s.weekday)
      const remaining = dates
        .map((d) => ({ d, at: localToUtc(d, s.startTime) }))
        .filter((x) => x.at.getTime() > earliest && !opts.hours?.closed.includes(x.d))
      if (remaining.length < opts.minSessions) continue
      if (remaining.some((x) => takenSet.has(takenKey(c.coachId, x.at)))) continue
      if (remaining.some((x) => !fits(opts, c.coachId, x.d, s.startTime, x.at))) continue
      const key = `${s.weekday} ${s.startTime}`
      const slot = byKey.get(key) ?? { weekday: s.weekday, time: s.startTime, sessions: remaining.map((x) => x.at.toISOString()), coachIds: [], awayDates: {} }
      if (!slot.coachIds.includes(c.coachId)) slot.coachIds.push(c.coachId)
      const away = remaining.filter((x) => isAway(x.d, c.away)).map((x) => x.d)
      if (away.length) slot.awayDates[c.coachId] = away
      byKey.set(key, slot)
    }
  }
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  return [...byKey.values()].sort((a, b) => dayOrder.indexOf(a.weekday) - dayOrder.indexOf(b.weekday) || a.time.localeCompare(b.time))
}

/** The open term slot for one coach + weekday + time, or null. */
export function findTermSlot(opts: Parameters<typeof termSlots>[0] & { coachId: number; weekday: string; time: string }) {
  const slot = termSlots(opts).find((s) => s.weekday === opts.weekday && s.time === opts.time && s.coachIds.includes(opts.coachId))
  return slot ?? null
}
