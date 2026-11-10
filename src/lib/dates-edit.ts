/**
 * Management → Set dates: which date fields may be changed, and turning what's typed (Melbourne time) into the
 * stored UTC value and back (pure — unit tested).
 */
import { localToUtc, localWeekdayTime, localYmd } from './time'

export type DateKind =
  | { kind: 'day'; at: string } // a calendar day, stored at this local time (e.g. 00:00 for a start, 23:59 for an end)
  | { kind: 'datetime' }
  | { kind: 'month' }
  | { kind: 'int'; min: number; max: number }

/** The only fields the Set dates page can write ("<collection>.<field>", or "g:<global>.<field>"). */
export const DATE_FIELDS: Record<string, DateKind> = {
  'academy-terms.startDate': { kind: 'day', at: '00:00' },
  'academy-terms.endDate': { kind: 'day', at: '23:59' },
  'academy-terms.availabilityDeadline': { kind: 'datetime' },
  'programs.startDate': { kind: 'datetime' },
  'programs.endDate': { kind: 'datetime' },
  'programs.opensAt': { kind: 'datetime' },
  'trial-sessions.start': { kind: 'datetime' },
  'report-cycles.dueDate': { kind: 'day', at: '22:00' },
  'pdr-challenges.month': { kind: 'month' },
  'selection-rounds.paymentDeadlineDays': { kind: 'int', min: 1, max: 60 },
  'g:site-settings.season': { kind: 'int', min: 2020, max: 2100 },
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const DATETIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/

/** Typed value → what's stored. Throws a friendly message when it isn't valid. Empty → null (field left unset). */
export function parseDateInput(k: DateKind, raw: string): string | number | null {
  const v = raw.trim()
  if (v === '') return null
  switch (k.kind) {
    case 'day':
      if (!DAY.test(v) || Number.isNaN(Date.parse(v))) throw new Error('Choose a date.')
      return localToUtc(v, k.at).toISOString()
    case 'datetime': {
      const m = DATETIME.exec(v)
      if (!m || Number.isNaN(Date.parse(m[1]))) throw new Error('Choose a date and time.')
      return localToUtc(m[1], m[2]).toISOString()
    }
    case 'month':
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) throw new Error('Use YYYY-MM, e.g. 2027-03.')
      return v
    case 'int': {
      const n = Number(v)
      if (!Number.isInteger(n) || n < k.min || n > k.max) throw new Error(`Enter a whole number from ${k.min} to ${k.max}.`)
      return n
    }
  }
}

/** Stored value → what the input shows (Melbourne time). */
export function formatDateInput(k: DateKind, stored: string | number | null | undefined): string {
  if (stored == null || stored === '') return ''
  if (k.kind === 'int' || k.kind === 'month') return String(stored)
  const d = new Date(stored)
  if (Number.isNaN(d.getTime())) return ''
  return k.kind === 'day' ? localYmd(d) : `${localYmd(d)}T${localWeekdayTime(d).time}`
}

export type DateIssue = { text: string; href: string }

type Dated = { id: number; name: string; status?: string | null; startDate?: string | null; endDate?: string | null; category?: string | null }
/**
 * Things to fix on the Set dates page (and the dashboard badge): no upcoming Academy term, programs still open after
 * they finished or with no dates, report rounds past their due date, and an out-of-date season year.
 */
export function dateIssues(o: { now: Date; terms: Dated[]; programs: (Dated & { type: string; termLinked: boolean })[]; cycles: (Dated & { dueDate: string; outstanding: number })[]; season: number | null; expectedSeason: number }): DateIssue[] {
  const out: DateIssue[] = []
  const now = o.now.getTime()
  const notClosed = o.terms.filter((t) => t.status !== 'closed' && t.endDate && Date.parse(t.endDate) > now)
  const live = notClosed.filter((t) => t.category !== 'school-holidays')
  const upcoming = live.filter((t) => t.startDate && Date.parse(t.startDate) > now)
  if (!live.length) out.push({ text: 'No current or upcoming school term timeframe — set up the next one.', href: '/admin/collections/academy-terms/create' })
  else if (!upcoming.length) out.push({ text: 'The next school term timeframe isn’t set up yet.', href: '/admin/collections/academy-terms/create' })
  // The next school holidays: set one up once the term before them is under way
  const holidays = notClosed.filter((t) => t.category === 'school-holidays')
  const current = live.find((t) => t.startDate && Date.parse(t.startDate) <= now)
  if (current && !holidays.some((h) => h.startDate && current.endDate && Date.parse(h.startDate) >= Date.parse(current.endDate))) {
    out.push({ text: `The school holidays after ${current.name} aren’t set up yet — add them so coaches can give holiday availability.`, href: '/admin/collections/academy-terms/create' })
  }
  for (const p of o.programs) {
    if (p.termLinked || p.type === 'community' || p.type === 'private-session' || p.type === 'registration') continue
    if (p.status !== 'open') continue
    if (!p.startDate) out.push({ text: `${p.name} is open but has no start date.`, href: '#programs' })
    else if (p.endDate && Date.parse(p.endDate) < now) out.push({ text: `${p.name} finished but is still open for bookings.`, href: `/admin/collections/programs/${p.id}` })
  }
  for (const c of o.cycles) {
    if (c.status === 'open' && Date.parse(c.dueDate) < now && c.outstanding > 0) out.push({ text: `${c.name}: due date has passed with ${c.outstanding} report${c.outstanding === 1 ? '' : 's'} unfinished.`, href: `/management/reports/${c.id}` })
  }
  if (o.season != null && o.season < o.expectedSeason) out.push({ text: `Season is set to ${o.season} — change it to ${o.expectedSeason} when the new season’s age groups start.`, href: '#season' })
  return out
}
