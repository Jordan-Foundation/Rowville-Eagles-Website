import { localToUtc, localYmd } from '../../lib/time'
import { groupLabel } from '../../lib/age-groups'
import { termDatesForWeekday, toYmd } from '../term-dates'
import type { Weekday } from '../constants'

/**
 * Academy term slots: a weekly time (e.g. Tuesday 5–6pm at Rowville Reserve) for certain years of birth.
 * Sessions are the slot's weekday across the term's dates, so changing a slot's time changes every
 * family's timetable at once. Individual weeks can be cancelled or moved with an exception.
 */
export type SlotShape = {
  id: number
  weekday: Weekday | string
  startTime: string
  endTime: string
  venue?: string | null
  birthYears?: number[] | null
  capacity?: number | null
  active?: boolean | null
  exceptions?: { date: string; cancelled?: boolean | null; startTime?: string | null; endTime?: string | null; note?: string | null }[] | null
}
export type TermDates = { startDate?: string | null; endDate?: string | null }
export type GroupSession = { date: string; startsAt: string; endsAt: string; cancelled: boolean; moved: boolean; note?: string }

/** Slots a player born in `birthYear` can join (active ones only). */
export const slotsForYear = <S extends Pick<SlotShape, 'birthYears' | 'active'>>(slots: S[], birthYear: number) =>
  slots.filter((s) => s.active !== false && (s.birthYears ?? []).includes(birthYear))

/** Every session of a slot in the term, with week-by-week exceptions applied. */
export function slotSessions(slot: SlotShape, term: TermDates): GroupSession[] {
  if (!term.startDate || !term.endDate) return []
  const ex = new Map((slot.exceptions ?? []).map((e) => [toYmd(e.date), e]))
  return termDatesForWeekday({ startDate: term.startDate, endDate: term.endDate }, slot.weekday as Weekday).map((date) => {
    const e = ex.get(date)
    const start = e?.startTime || slot.startTime
    const end = e?.endTime || slot.endTime
    return {
      date,
      startsAt: localToUtc(date, start).toISOString(),
      endsAt: localToUtc(date, end).toISOString(),
      cancelled: Boolean(e?.cancelled),
      moved: Boolean(e && !e.cancelled && (e.startTime || e.endTime)),
      note: e?.note ?? undefined,
    }
  })
}

/** Sessions still to come (not cancelled), from `now`. */
export const upcomingSessions = (slot: SlotShape, term: TermDates, now = new Date()) =>
  slotSessions(slot, term).filter((s) => !s.cancelled && new Date(s.endsAt) > now)

const hm = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`
}
export const timeRange = (s: Pick<SlotShape, 'startTime' | 'endTime'>) => `${hm(s.startTime)}–${hm(s.endTime)}`

/** "Tuesday 5pm–6pm · Rowville Reserve" */
export const slotLabel = (s: Pick<SlotShape, 'weekday' | 'startTime' | 'endTime' | 'venue'>) => [`${s.weekday} ${timeRange(s)}`, s.venue].filter(Boolean).join(' · ')

/** "2016s & 2017s" */
export const yearsLabel = (years: number[] | null | undefined) => {
  const l = [...(years ?? [])].sort((a, b) => b - a).map(groupLabel)
  return l.length <= 1 ? (l[0] ?? '') : `${l.slice(0, -1).join(', ')} & ${l.at(-1)}`
}

export const spotsLeft = (s: Pick<SlotShape, 'capacity'>, taken: number) => (s.capacity ? Math.max(0, s.capacity - taken) : null)

/**
 * What the booking form should offer: one slot fits → that one; several → choose;
 * none (or all full) → register interest.
 */
export function slotChoice<S extends SlotShape>(slots: S[], birthYear: number, taken: Map<number, number>, bookable: (s: S) => boolean = () => true) {
  const fits = slotsForYear(slots, birthYear).filter(bookable)
  const open = fits.filter((s) => spotsLeft(s, taken.get(s.id) ?? 0) !== 0)
  if (open.length === 0) return { mode: 'interest' as const, reason: fits.length ? ('full' as const) : ('no_slot' as const), slots: [] as S[] }
  return { mode: open.length === 1 ? ('auto' as const) : ('choose' as const), reason: null, slots: open }
}

export const todayYmd = () => localYmd(new Date())

// ── Price: like 1-on-1 terms, families pay per session for the sessions still to come ──

/** Sessions starting within this many hours can't be booked (same as 1-on-1s). */
export const TERM_CUTOFF_HOURS = 24
/** A term needs at least this many sessions left to be bookable. */
export const TERM_MIN_SESSIONS = 2

export type TermPricing = { pricePerSession?: number | null; price?: number | null }

/**
 * What a family pays to join this slot now: price per session × sessions left (not cancelled, starting
 * more than 24h from now). Programs without a per-session price charge their flat price.
 */
export function termQuote(slot: SlotShape, term: TermDates, pricing: TermPricing, now = new Date()) {
  const cutoff = now.getTime() + TERM_CUTOFF_HOURS * 3_600_000
  const sessions = slotSessions(slot, term).filter((s) => !s.cancelled && new Date(s.startsAt).getTime() > cutoff)
  const perSession = pricing.pricePerSession ?? null
  const total = perSession !== null ? Math.round(perSession * sessions.length * 100) / 100 : (pricing.price ?? 0)
  return { sessions, count: sessions.length, perSession, total, bookable: sessions.length >= TERM_MIN_SESSIONS }
}
