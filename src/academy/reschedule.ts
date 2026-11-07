import { WEEKDAYS, type Weekday } from './constants'
import { isAway } from './term-dates'
import { localToUtc, localWeekdayTime, localYmd } from '../lib/time'

/**
 * Rescheduling maths (pure). Moving the rest of a term keeps each session in its own week
 * (Monday–Sunday, Sydney time) and moves it to the new weekday and time — so the number of
 * sessions, and what the family has paid for, never changes.
 */

export type Move = { sessionId: number; from: string; to: string; coachId: number }

const DAY = 86_400_000

/** The date (YYYY-MM-DD) of `weekday` in the same Monday–Sunday week as `ymd`. */
export function sameWeekDate(ymd: string, weekday: Weekday) {
  const d = new Date(`${ymd}T00:00:00Z`)
  const mondayOffset = (d.getUTCDay() + 6) % 7 // 0 = Monday
  const target = WEEKDAYS.indexOf(weekday)
  return new Date(d.getTime() + (target - mondayOffset) * DAY).toISOString().slice(0, 10)
}

export function planTermMove(o: {
  sessions: { id: number; startsAt: string; coachId: number }[]
  weekday: Weekday
  time: string
  coachId?: number
}): Move[] {
  return o.sessions.map((s) => ({
    sessionId: s.id,
    from: s.startsAt,
    to: localToUtc(sameWeekDate(localYmd(new Date(s.startsAt)), o.weekday), o.time).toISOString(),
    coachId: o.coachId ?? s.coachId,
  }))
}

export type CoachAvailabilityLite = { coachId: number; slots: { weekday: string; startTime: string }[]; away: { from: string; to: string }[] }

/** Problems that block the move, and things staff should know but may override. */
export function checkMoves(
  moves: Move[],
  o: { now: Date; termEnd?: string | null; availability: CoachAvailabilityLite[]; taken: { coachId: number; startsAt: string; sessionId: number }[] },
) {
  const errors: string[] = []
  const warnings: string[] = []
  const movedIds = new Set(moves.map((m) => m.sessionId))
  const seen = new Set<string>()
  const outside: string[] = []
  for (const m of moves) {
    const label = new Date(m.to).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    if (new Date(m.to).getTime() <= o.now.getTime()) errors.push(`${label} is in the past.`)
    const key = `${m.coachId}|${new Date(m.to).getTime()}`
    if (seen.has(key)) errors.push(`Two sessions would be at ${label}.`)
    seen.add(key)
    if (o.taken.some((t) => t.coachId === m.coachId && new Date(t.startsAt).getTime() === new Date(m.to).getTime() && !movedIds.has(t.sessionId))) {
      errors.push(`The coach already has a session at ${label}.`)
    }
    const a = o.availability.find((x) => x.coachId === m.coachId)
    const { weekday, time } = localWeekdayTime(m.to)
    if (!a || !a.slots.some((s) => s.weekday === weekday && s.startTime === time)) outside.push(label)
    if (a && isAway(localYmd(new Date(m.to)), a.away)) warnings.push(`The coach is away on ${label} — it will be flagged as needing cover.`)
    if (o.termEnd && new Date(m.to).getTime() > new Date(o.termEnd).getTime()) warnings.push(`${label} is after the end of term.`)
  }
  if (outside.length === 1) warnings.unshift(`${outside[0]} is outside the coach’s set availability.`)
  if (outside.length > 1) warnings.unshift(`${outside.length} new times are outside the coach’s set availability (${outside.join('; ')}).`)
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] }
}
