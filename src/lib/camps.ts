/**
 * Holiday camps: the camp days, the full-camp vs per-day price, and places per day.
 * Pure (no database) so it can be unit tested and used on both the server and the booking form.
 * Dates are Sydney calendar days as YYYY-MM-DD.
 */
import { localWeekdayTime, localYmd } from './time'

export const CAMP_DEFAULTS = { fullPrice: 300, dayPrice: 110, start: '09:00', end: '15:00' } as const

export type CampDay = { date: string; start: string; end: string }

type CampLike = {
  campDays?: { date?: string | null; startTime?: string | null; endTime?: string | null }[] | null
  startDate?: string | null
  endDate?: string | null
  fullCampPrice?: number | null
  dayPrice?: number | null
  price?: number | null
}

const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const isWeekend = (ymd: string) => [0, 6].includes(new Date(`${ymd}T00:00:00Z`).getUTCDay())
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/** Weekdays from the first to the last day (inclusive). */
export function weekdaysBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to && out.length < 60; d = addDays(d, 1)) if (!isWeekend(d)) out.push(d)
  return out
}

/**
 * The camp's days: the list set on the camp, or (for camps set up before days existed) every weekday
 * between the start and end dates, with the start/end times taken from those dates.
 */
export function campDayList(c: CampLike): CampDay[] {
  const set = (c.campDays ?? []).filter((d) => d.date)
  if (set.length) {
    return set
      .map((d) => ({ date: localYmd(new Date(d.date!)), start: TIME.test(d.startTime ?? '') ? d.startTime! : CAMP_DEFAULTS.start, end: TIME.test(d.endTime ?? '') ? d.endTime! : CAMP_DEFAULTS.end }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .filter((d, i, all) => i === 0 || all[i - 1].date !== d.date)
  }
  if (!c.startDate) return []
  const start = new Date(c.startDate)
  const end = c.endDate ? new Date(c.endDate) : start
  const t = (d: Date, fallback: string) => {
    const hm = localWeekdayTime(d).time
    return hm === '00:00' || hm === '23:59' ? fallback : hm
  }
  return weekdaysBetween(localYmd(start), localYmd(end)).map((date) => ({ date, start: t(start, CAMP_DEFAULTS.start), end: t(end, CAMP_DEFAULTS.end) }))
}

export function campPrices(c: CampLike) {
  return {
    full: c.fullCampPrice ?? c.price ?? CAMP_DEFAULTS.fullPrice,
    day: c.dayPrice ?? CAMP_DEFAULTS.dayPrice,
  }
}

const money = (n: number) => Math.round(n * 100) / 100

/** How much the full camp saves against paying for every day separately (0 if it doesn't). */
export const fullCampSaving = (prices: { full: number; day: number }, days: number) => Math.max(0, money(prices.day * days - prices.full))

export type CampQuote = {
  fullCamp: boolean
  days: string[]
  /** Per child */
  total: number
  /** What the chosen days would cost one by one */
  dayTotal: number
  /** The chosen days cost more than the full camp */
  suggestFull: boolean
  /** How much switching to the full camp would save (per child) */
  saving: number
}

/**
 * The price per child for a choice. Choosing every day counts as the full camp (it's never dearer).
 * Returns null if nothing valid was chosen.
 */
export function campQuote(o: { allDays: string[]; full: boolean; days: string[]; prices: { full: number; day: number } }): CampQuote | null {
  const all = [...new Set(o.allDays)].sort()
  if (!all.length) return null
  const chosen = [...new Set(o.days)].filter((d) => all.includes(d)).sort()
  const fullCamp = o.full || chosen.length === all.length
  if (fullCamp) return { fullCamp: true, days: all, total: o.prices.full, dayTotal: money(all.length * o.prices.day), suggestFull: false, saving: 0 }
  if (!chosen.length) return null
  const dayTotal = money(chosen.length * o.prices.day)
  return { fullCamp: false, days: chosen, total: dayTotal, dayTotal, suggestFull: dayTotal > o.prices.full, saving: Math.max(0, money(dayTotal - o.prices.full)) }
}

/**
 * Children booked on each day. Each booking counts on its days; bookings with no days listed
 * (full camp, or made before days existed) count on every day.
 */
export function placesByDay(allDays: string[], bookings: { campDays?: { day?: string | null }[] | null; fullCamp?: boolean | null }[]) {
  const counts = new Map(allDays.map((d) => [d, 0]))
  for (const b of bookings) {
    const days = b.fullCamp || !(b.campDays ?? []).length ? allDays : (b.campDays ?? []).map((d) => d.day).filter((d): d is string => !!d)
    for (const d of days) if (counts.has(d)) counts.set(d, counts.get(d)! + 1)
  }
  return counts
}

/** "Mon 5 Jan" */
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const campDayLabel = (ymd: string) => {
  const d = new Date(`${ymd}T12:00:00Z`)
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MO[d.getUTCMonth()]}`
}

/** "9am–3pm" */
export const campHoursLabel = (d: { start: string; end: string }) => {
  const f = (hm: string) => {
    const [h, m] = hm.split(':').map(Number)
    return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`
  }
  return `${f(d.start)}–${f(d.end)}`
}

/** "Full camp (4 days)" or "Mon 5 Jan, Wed 7 Jan" */
export const campChoiceLabel = (o: { fullCamp?: boolean | null; days: string[]; totalDays: number }) =>
  o.fullCamp || o.days.length === 0 ? `Full camp (${o.totalDays} day${o.totalDays === 1 ? '' : 's'})` : o.days.map(campDayLabel).join(', ')
