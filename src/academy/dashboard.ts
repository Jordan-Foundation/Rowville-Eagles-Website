import type { CoachAvailability } from './slots'
import { isAway, slotOccurrences, toYmd, type TermShape } from './term-dates'

/** Pure helpers for the staff dashboard. */

/** Bookable 1-on-1 hours a coach offered across the whole term (their weekly times × term weeks, less away dates). */
export function coachCapacity(term: TermShape, coach: CoachAvailability): number {
  let n = 0
  for (const s of coach.slots) for (const d of slotOccurrences(term, s.weekday, s.startTime)) if (!isAway(toYmd(d.toISOString()), coach.away)) n++
  return n
}

/** Utilisation as a whole percentage (0 when nothing was offered). */
export const utilisation = (booked: number, capacity: number) => (capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0)
