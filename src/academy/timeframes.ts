/**
 * Timeframes: the Academy calendar. Each one is a school term (Terms 1–4) or a school holiday break.
 * They're stored in the `academy-terms` collection (the slug is kept so existing bookings keep working).
 *
 * - Academy training programs only run in school terms.
 * - 1-on-1s and small groups run in every timeframe; coaches set availability per timeframe.
 * - Holiday camps sit inside a holiday timeframe.
 */

export const TIMEFRAME_PERIODS = [
  { value: 'term-1', label: 'Term 1', category: 'school-term' },
  { value: 'term-2', label: 'Term 2', category: 'school-term' },
  { value: 'term-3', label: 'Term 3', category: 'school-term' },
  { value: 'term-4', label: 'Term 4', category: 'school-term' },
  { value: 'summer', label: 'Summer holidays', category: 'school-holidays' },
  { value: 'april', label: 'April holidays', category: 'school-holidays' },
  { value: 'mid-year', label: 'Mid-year holidays', category: 'school-holidays' },
  { value: 'september', label: 'September holidays', category: 'school-holidays' },
] as const

export type TimeframePeriod = (typeof TIMEFRAME_PERIODS)[number]['value']
export type TimeframeCategory = 'school-term' | 'school-holidays'

export const TIMEFRAME_CATEGORIES: { value: TimeframeCategory; label: string }[] = [
  { value: 'school-term', label: 'School term' },
  { value: 'school-holidays', label: 'School holidays' },
]

export const categoryOfPeriod = (period: string | null | undefined): TimeframeCategory | null =>
  TIMEFRAME_PERIODS.find((p) => p.value === period)?.category ?? null

export const periodLabel = (period: string | null | undefined) => TIMEFRAME_PERIODS.find((p) => p.value === period)?.label ?? null

/** Work out the period from a name like "Term 2 2027", "T3", "Summer holidays 2027/28" or "Christmas break". */
export function periodFromName(name: string | null | undefined): TimeframePeriod | null {
  const n = (name ?? '').toLowerCase()
  const term = n.match(/\b(?:term|t)\s*([1-4])\b/)
  if (term) return `term-${term[1]}` as TimeframePeriod
  if (/summer|christmas|xmas/.test(n)) return 'summer'
  if (/april|easter|autumn/.test(n)) return 'april'
  if (/mid[\s-]?year|june|july|winter/.test(n)) return 'mid-year'
  if (/sept|spring/.test(n)) return 'september'
  return null
}

type Kinded = { category?: string | null }

/** Timeframes saved before categories existed are school terms. */
export const isHolidayTimeframe = (t: Kinded | null | undefined) => t?.category === 'school-holidays'
export const isSchoolTerm = (t: Kinded | null | undefined) => !!t && !isHolidayTimeframe(t)

/** Weekly bookings (1-on-1 terms, term small groups, academy programs) only run in school terms. */
export const allowsWeekly = isSchoolTerm

/** Payload `where` that matches school terms, including any saved before categories existed. */
export const schoolTermWhere = { or: [{ category: { equals: 'school-term' } }, { category: { exists: false } }] }

/** "Term" for school terms, "holidays" for breaks — for wording like "the rest of the term". */
export const timeframeNoun = (t: Kinded | null | undefined) => (isHolidayTimeframe(t) ? 'holidays' : 'term')
