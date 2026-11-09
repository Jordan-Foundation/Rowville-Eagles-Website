import { localToUtc, localWeekdayTime } from '@/lib/time'
import type { Weekday } from './constants'
import { termDatesForWeekday, toYmd, type TermShape } from './term-dates'

/**
 * Term offer on a one-off small group (pure — unit tested).
 * The one-off becomes week 1; the rest of the term is every later week at the same weekday and time
 * (after the booking cut-off). What a family paid for the one-off counts: the difference between the
 * one-off price and the term price of week 1 comes off their term total.
 */
export function laterWeeks(term: TermShape, oneOffAt: string, o: { now: Date; cutoffHours: number }) {
  const { weekday, time } = localWeekdayTime(oneOffAt)
  const after = toYmd(oneOffAt)
  const earliest = o.now.getTime() + o.cutoffHours * 3_600_000
  const weeks = termDatesForWeekday(term, weekday as Weekday)
    .filter((d) => d > after)
    .map((d) => localToUtc(d, time))
    .filter((at) => at.getTime() > earliest)
    .map((at) => at.toISOString())
  return { weekday: weekday as Weekday, time, weeks }
}

const cents = (n: number) => Math.round(n * 100) / 100

/** Week 1 was paid at the one-off price; the term price is lower — the difference comes off the term. */
export const week1Credit = (oneOffPaid: number, termRate: number) => cents(Math.max(0, oneOffPaid - termRate))

/** The term price per session for a group, from its locked one-off price less the term discount. */
export const termRateFrom = (casualRate: number, discountPct: number) => cents(casualRate * (1 - Math.min(100, Math.max(0, discountPct)) / 100))

/** What one family pays for the rest of the term (weeks 2 onwards). */
export function restOfTermQuote(casualRate: number, discountPct: number, laterWeekCount: number, oneOffPaid: number) {
  const rate = termRateFrom(casualRate, discountPct)
  const credit = week1Credit(oneOffPaid, rate)
  const full = cents(rate * laterWeekCount)
  return { rate, weeks: laterWeekCount, full, credit, total: cents(Math.max(0, full - credit)), saving: cents((casualRate - rate) * (laterWeekCount + 1)) }
}
