/**
 * Default 1-on-1 booking hours and the back-to-back rule (pure — unit tested).
 *
 * Bookable hours depend on the day:
 * - school term weekdays: 4pm–9pm; school term weekends: 7am–9pm;
 * - school holidays (any date outside a school term): 7am–9pm every day;
 * - closed dates (e.g. Christmas Day): nothing.
 * Sessions run back to back inside the window (1-hour sessions → the last one is 8–9pm). A coach's own
 * availability is only bookable where it falls inside these hours.
 *
 * Back-to-back (customer booking pages only): once a coach has a booking on a day, families only see the
 * slots that touch an existing booking (ending exactly when one starts, or starting exactly when one ends).
 */
import { localToUtc, localYmd } from '../lib/time'

export type Window = { from: string; to: string }
export type DayType = 'term' | 'holiday'
export type Range = { start: string; end: string }

export type BookingHours = {
  termWeekday: Window
  termWeekend: Window
  holiday: Window
  /** YYYY-MM-DD dates with no sessions at all */
  closed: string[]
  /** School terms (YYYY-MM-DD, inclusive). Any date outside these is a school holiday. */
  terms: Range[]
}

export const DEFAULT_HOURS = {
  termWeekday: { from: '16:00', to: '21:00' },
  termWeekend: { from: '07:00', to: '21:00' },
  holiday: { from: '07:00', to: '21:00' },
} as const

/**
 * Victorian government school terms — used for any year that has no school-term timeframes yet.
 * Once Management sets up a year's terms (Yearly setup or Timeframes), those dates are used instead.
 */
export const VIC_SCHOOL_TERMS: Range[] = [
  { start: '2026-10-05', end: '2026-12-18' },
  { start: '2027-01-27', end: '2027-03-25' },
  { start: '2027-04-12', end: '2027-06-25' },
  { start: '2027-07-12', end: '2027-09-17' },
  { start: '2027-10-04', end: '2027-12-17' },
]

/** Timeframe terms win for any year they cover; the built-in Victorian dates fill the other years. */
export function mergeTerms(fromTimeframes: Range[], seed: Range[] = VIC_SCHOOL_TERMS): Range[] {
  const covered = new Set(fromTimeframes.flatMap((r) => [r.start.slice(0, 4), r.end.slice(0, 4)]))
  return [...fromTimeframes, ...seed.filter((r) => !covered.has(r.start.slice(0, 4)))].sort((a, b) => a.start.localeCompare(b.start))
}

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/
const mins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
/** Monday = 1 … Sunday = 7 for a YYYY-MM-DD date. */
const isoDay = (ymd: string) => ((new Date(`${ymd}T12:00:00Z`).getUTCDay() + 6) % 7) + 1
export const isWeekendDate = (ymd: string) => isoDay(ymd) >= 6
const weekendName = (weekday: string) => weekday === 'Saturday' || weekday === 'Sunday'

export const dayTypeOf = (ymd: string, terms: Range[]): DayType => (terms.some((t) => ymd >= t.start && ymd <= t.end) ? 'term' : 'holiday')

/** The bookable window on a date, or null when it's closed. */
export function windowOn(ymd: string, h: BookingHours): Window | null {
  if (h.closed.includes(ymd)) return null
  if (dayTypeOf(ymd, h.terms) === 'holiday') return h.holiday
  return isWeekendDate(ymd) ? h.termWeekend : h.termWeekday
}

/** Back-to-back start times that fit inside a window (e.g. 16:00 → 20:00 for 1-hour sessions in 4pm–9pm). */
export function startsIn(w: Window | null, sessionMinutes: number): string[] {
  if (!w || !TIME_RE.test(w.from) || !TIME_RE.test(w.to)) return []
  const len = Math.max(15, sessionMinutes || 60)
  const out: string[] = []
  for (let m = mins(w.from); m + len <= mins(w.to); m += len) out.push(hhmm(m))
  return out
}

/** Does a session starting at `time` on `ymd` fit inside that day's bookable hours? */
export function withinHours(ymd: string, time: string, sessionMinutes: number, h: BookingHours) {
  const w = windowOn(ymd, h)
  if (!w) return false
  const start = mins(time)
  return start >= mins(w.from) && start + (sessionMinutes || 60) <= mins(w.to)
}

/** Times a coach can choose for a weekday in a timeframe (the weekly availability grid). */
export function weeklyStarts(kind: DayType, weekday: string, h: Pick<BookingHours, 'termWeekday' | 'termWeekend' | 'holiday'>, sessionMinutes: number) {
  const w = kind === 'holiday' ? h.holiday : weekendName(weekday) ? h.termWeekend : h.termWeekday
  return startsIn(w, sessionMinutes)
}

// ─── Back-to-back ──────────────────────────────────────────────────────────────

export type BackToBack = {
  /** Live sessions (booked or mid-checkout) — the booked blocks */
  booked: { coachId: number; startsAt: string; endsAt: string }[]
  /** Coaches the rule is switched off for */
  off: number[]
  /** Show every slot again this many hours before the day starts (0 = never) */
  releaseHours: number
  now: Date
}

const index = new WeakMap<BackToBack['booked'], Map<string, BackToBack['booked']>>()
/** Booked blocks grouped by coach + Sydney day (built once per list). */
function byCoachDay(r: BackToBack) {
  let m = index.get(r.booked)
  if (!m) {
    m = new Map()
    for (const b of r.booked) {
      const k = `${b.coachId}|${localYmd(new Date(b.startsAt))}`
      m.set(k, [...(m.get(k) ?? []), b])
    }
    index.set(r.booked, m)
  }
  return m
}

/**
 * Can a family see this slot under the back-to-back rule? Per coach, per day:
 * no bookings that day → yes; otherwise only if it touches a booking (its end = a booking's start, or its start = a booking's end).
 * Sessions of different lengths: adjacency is exact (end time equals start time).
 */
export function touchesBooking(coachId: number, startsAt: string | Date, sessionMinutes: number, r: BackToBack): boolean {
  if (r.off.includes(coachId)) return true
  const start = new Date(startsAt).getTime()
  const ymd = localYmd(new Date(start))
  if (r.releaseHours > 0 && r.now.getTime() >= localToUtc(ymd, '00:00').getTime() - r.releaseHours * 3_600_000) return true
  const sameDay = byCoachDay(r).get(`${coachId}|${ymd}`)
  if (!sameDay?.length) return true
  const end = start + sessionMinutes * 60_000
  return sameDay.some((b) => new Date(b.endsAt).getTime() === start || new Date(b.startsAt).getTime() === end)
}
