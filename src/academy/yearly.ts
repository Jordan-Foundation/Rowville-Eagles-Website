/**
 * Yearly setup (pure — unit tested). Each November Management enters next year's Term 1–4 dates;
 * the school holidays, coach availability deadlines and Academy term programs follow from them.
 * All dates are Sydney calendar days (YYYY-MM-DD).
 */
import { localYmd } from '../lib/time'

export type Range = { start: string; end: string }
export type HolidayPeriod = 'summer' | 'april' | 'mid-year' | 'september'
export const HOLIDAY_ORDER: { period: HolidayPeriod; label: string }[] = [
  { period: 'summer', label: 'Summer holidays' },
  { period: 'april', label: 'April holidays' },
  { period: 'mid-year', label: 'Mid-year holidays' },
  { period: 'september', label: 'September holidays' },
]
export const DEADLINE_WEEKS = 3
export const DEADLINE_TIME = '17:00'

const YMD = /^\d{4}-\d{2}-\d{2}$/
export const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Problems with the four term dates (empty when they're fine). */
export function termProblems(year: number, terms: Range[]): string[] {
  const out: string[] = []
  if (terms.length !== 4) return ['Enter all four terms.']
  terms.forEach((t, i) => {
    const n = i + 1
    if (!YMD.test(t.start) || !YMD.test(t.end)) out.push(`Term ${n}: enter both the first and last day.`)
    else if (t.end < t.start) out.push(`Term ${n}: the last day is before the first day.`)
    else if (!t.start.startsWith(String(year)) || !t.end.startsWith(String(year))) out.push(`Term ${n}: the dates should be in ${year}.`)
  })
  if (out.length) return out
  for (let i = 1; i < 4; i++) if (terms[i].start <= terms[i - 1].end) out.push(`Term ${i + 1} starts before Term ${i} ends.`)
  return out
}

/**
 * The four school holiday breaks for a year: summer (before Term 1 — from the day after last year's
 * Term 4, or 19 December if that isn't known), then the gaps between the terms.
 */
export function holidaysFor(terms: Range[], lastTerm4End?: string | null): (Range & { period: HolidayPeriod })[] {
  const summerStart = lastTerm4End && YMD.test(lastTerm4End) ? addDays(lastTerm4End, 1) : `${Number(terms[0].start.slice(0, 4)) - 1}-12-19`
  return [
    { period: 'summer', start: summerStart, end: addDays(terms[0].start, -1) },
    { period: 'april', start: addDays(terms[0].end, 1), end: addDays(terms[1].start, -1) },
    { period: 'mid-year', start: addDays(terms[1].end, 1), end: addDays(terms[2].start, -1) },
    { period: 'september', start: addDays(terms[2].end, 1), end: addDays(terms[3].start, -1) },
  ]
}

/** Coach availability is due 3 weeks before each timeframe starts (5pm Sydney). */
export const defaultDeadline = (start: string) => addDays(start, -7 * DEADLINE_WEEKS)

/** Which year to set up now: next year from November on, otherwise this year. */
export function setupYear(now: Date) {
  const ymd = localYmd(now)
  const y = Number(ymd.slice(0, 4))
  return Number(ymd.slice(5, 7)) >= 11 ? y + 1 : y
}

/** From 1 November, next year's setup is due until it's published. */
export function setupDue(now: Date, publishedYears: number[]) {
  const ymd = localYmd(now)
  if (Number(ymd.slice(5, 7)) < 11) return null
  const year = Number(ymd.slice(0, 4)) + 1
  return publishedYears.includes(year) ? null : year
}
