import type { Payload } from 'payload'
import { DEFAULT_HOURS, mergeTerms, type BookingHours } from './hours'
import { schoolTermWhere } from './timeframes'
import { toYmd } from './term-dates'

export type BackToBackSettings = { enabled: boolean; appliesTo: ('casual' | 'term' | 'pack')[]; releaseHours: number }
type Settings = {
  bookingHours?: Partial<Record<'termWeekdayFrom' | 'termWeekdayTo' | 'termWeekendFrom' | 'termWeekendTo' | 'holidayFrom' | 'holidayTo', string | null>> | null
  closedDates?: { date?: string | null }[] | null
  backToBack?: { enabled?: boolean | null; appliesTo?: string[] | null; releaseHours?: number | null } | null
}

/** Booking hours from Academy settings, with school terms from the Timeframes (Victorian dates fill any year not set up yet). */
export async function loadBookingHours(p: Payload): Promise<BookingHours & { backToBack: BackToBackSettings }> {
  const [s, { docs }] = await Promise.all([
    p.findGlobal({ slug: 'academy-settings', depth: 0, overrideAccess: true }).catch(() => ({})) as Promise<Settings>,
    p.find({ collection: 'academy-terms', where: schoolTermWhere, pagination: false, limit: 200, depth: 0, overrideAccess: true, select: { startDate: true, endDate: true } }),
  ])
  const h = s.bookingHours ?? {}
  const win = (from: string | null | undefined, to: string | null | undefined, d: { from: string; to: string }) => ({ from: from || d.from, to: to || d.to })
  const b = s.backToBack ?? {}
  return {
    termWeekday: win(h.termWeekdayFrom, h.termWeekdayTo, DEFAULT_HOURS.termWeekday),
    termWeekend: win(h.termWeekendFrom, h.termWeekendTo, DEFAULT_HOURS.termWeekend),
    holiday: win(h.holidayFrom, h.holidayTo, DEFAULT_HOURS.holiday),
    closed: (s.closedDates ?? []).map((c) => (c.date ? toYmd(c.date) : '')).filter(Boolean),
    terms: mergeTerms(docs.filter((t) => t.startDate && t.endDate).map((t) => ({ start: toYmd(t.startDate), end: toYmd(t.endDate) }))),
    backToBack: {
      enabled: b.enabled !== false,
      appliesTo: (b.appliesTo ?? ['casual', 'term', 'pack']) as BackToBackSettings['appliesTo'],
      releaseHours: Math.max(0, b.releaseHours ?? 0),
    },
  }
}
