import { localToUtc, localYmd } from '../lib/time'
import { WEEKDAYS, type Weekday } from './constants'

/** JS getUTCDay() index (0 = Sunday) for a weekday name. */
const jsDay = (d: Weekday) => (WEEKDAYS.indexOf(d) + 1) % 7

const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export type TermShape = { startDate: string; sessions: number; skipDates?: string[] }

/** Calendar date (YYYY-MM-DD, Australia/Sydney) of a stored date value. */
export const toYmd = (value: string | Date) => localYmd(new Date(value))

/**
 * The session dates for one weekday in a term. Starts at the first `weekday` on/after the term start,
 * runs weekly, and skips any date in `skipDates` — the term is pushed later so there are always
 * `sessions` dates (10 by default).
 */
export function termDatesForWeekday(term: TermShape, weekday: Weekday): string[] {
  const start = toYmd(term.startDate)
  const skip = new Set((term.skipDates ?? []).map(toYmd))
  const first = addDays(start, (jsDay(weekday) - new Date(`${start}T00:00:00Z`).getUTCDay() + 7) % 7)
  const out: string[] = []
  for (let d = first, guard = 0; out.length < term.sessions && guard < 200; d = addDays(d, 7), guard++) {
    if (!skip.has(d)) out.push(d)
  }
  return out
}

/** Last session date across every weekday — the term's end date. */
export function termEndDate(term: TermShape): string {
  return WEEKDAYS.map((w) => termDatesForWeekday(term, w).at(-1)!).sort().at(-1)!
}

/** UTC start instants of a weekly slot (weekday + "HH:MM") for the whole term. */
export function slotOccurrences(term: TermShape, weekday: Weekday, startTime: string): Date[] {
  return termDatesForWeekday(term, weekday).map((d) => localToUtc(d, startTime))
}

/** Human summary for the admin: "Tue: 3 Feb → 7 Apr (skips 24 Mar)". */
export function scheduleSummary(term: TermShape): string {
  const fmt = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const skip = new Set((term.skipDates ?? []).map(toYmd))
  return WEEKDAYS.map((w) => {
    const dates = termDatesForWeekday(term, w)
    const first = dates[0]
    const last = dates.at(-1)!
    const skipped = [...skip].filter((s) => s >= first && s <= last && new Date(`${s}T00:00:00Z`).getUTCDay() === jsDay(w))
    return `${w.slice(0, 3)}: ${fmt(first)} → ${fmt(last)}${skipped.length ? ` (skips ${skipped.map(fmt).join(', ')})` : ''}`
  }).join('\n')
}
