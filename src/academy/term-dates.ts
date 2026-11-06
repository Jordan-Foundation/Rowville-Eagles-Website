import { localToUtc, localYmd } from '../lib/time'
import { WEEKDAYS, type Weekday } from './constants'

/** JS getUTCDay() index (0 = Sunday) for a weekday name. */
const jsDay = (d: Weekday) => (WEEKDAYS.indexOf(d) + 1) % 7

const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** A term runs from its start date to its end date (the school term). */
export type TermShape = { startDate: string; endDate: string }

/** Calendar date (YYYY-MM-DD, Australia/Sydney) of a stored date value. */
export const toYmd = (value: string | Date) => localYmd(new Date(value))

/**
 * Every date this weekday falls on within the term (inclusive). The count varies by weekday
 * (e.g. 9, 10 or 11 sessions) because it simply follows the school term dates.
 */
export function termDatesForWeekday(term: TermShape, weekday: Weekday): string[] {
  const start = toYmd(term.startDate)
  const end = toYmd(term.endDate)
  const first = addDays(start, (jsDay(weekday) - new Date(`${start}T00:00:00Z`).getUTCDay() + 7) % 7)
  const out: string[] = []
  for (let d = first; d <= end && out.length < 60; d = addDays(d, 7)) out.push(d)
  return out
}

/** UTC start instants of a weekly slot (weekday + "HH:MM") for the whole term. */
export function slotOccurrences(term: TermShape, weekday: Weekday, startTime: string): Date[] {
  return termDatesForWeekday(term, weekday).map((d) => localToUtc(d, startTime))
}

/** Human summary for the admin: "Tue: 10 sessions · 2 Feb → 6 Apr". */
export function scheduleSummary(term: TermShape): string {
  const fmt = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return WEEKDAYS.map((w) => {
    const dates = termDatesForWeekday(term, w)
    if (!dates.length) return `${w.slice(0, 3)}: no sessions`
    return `${w.slice(0, 3)}: ${dates.length} session${dates.length === 1 ? '' : 's'} · ${fmt(dates[0])} → ${fmt(dates.at(-1)!)}`
  }).join('\n')
}

/** Does a calendar date (YYYY-MM-DD) fall inside any away period? */
export function isAway(ymd: string, periods: { from: string; to: string }[] | null | undefined) {
  return (periods ?? []).some((p) => ymd >= toYmd(p.from) && ymd <= toYmd(p.to))
}
