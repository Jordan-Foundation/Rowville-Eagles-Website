/**
 * Academy term pricing (pure — unit tested).
 *
 *  Per session (Terms 2 and 3): price per session × sessions left in the chosen training time(s).
 *  Per term   (Terms 1 and 4): one price for the term at 2 sessions a week ($400), pro-rata for late
 *              joiners — term price × sessions left ÷ sessions in the term. An age group with only one
 *              training time pays half the term price (1 session a week), also pro-rata.
 *  Full year: the four term prices added together, less a discount (10%).
 */
import { slotSessions, TERM_CUTOFF_HOURS, type SlotShape, type TermDates } from './slots'

export const TERM_PRICE_DEFAULT = 400
export const FULL_YEAR_DISCOUNT_DEFAULT = 10
export const CLUB_REGISTRATION_FEE_DEFAULT = 950

const round = (n: number) => Math.round(n * 100) / 100

export type TermPricingProgram = { pricingMode?: string | null; termPrice?: number | null; pricePerSession?: number | null; twoNightPricePerSession?: number | null; price?: number | null }
export const isPerTerm = (p: TermPricingProgram) => p.pricingMode === 'per-term'

/** Sessions in the term (not cancelled) and sessions still to come (more than 24h away), per slot. */
export function slotCounts(slot: SlotShape, term: TermDates, now = new Date()) {
  const all = slotSessions(slot, term).filter((s) => !s.cancelled)
  const cutoff = now.getTime() + TERM_CUTOFF_HOURS * 3_600_000
  return { all: all.length, left: all.filter((s) => new Date(s.startsAt).getTime() > cutoff).length }
}

/**
 * Per-term price for the chosen training times: the term price (2 a week; half for 1 a week) × sessions
 * left ÷ sessions in the term. Returns the total and each slot's share (in proportion to its sessions left).
 */
export function perTermQuote(program: TermPricingProgram, counts: { all: number; left: number }[]) {
  const termPrice = program.termPrice ?? TERM_PRICE_DEFAULT
  const full = counts.length >= 2 ? termPrice : termPrice / 2
  const all = counts.reduce((n, c) => n + c.all, 0)
  const left = counts.reduce((n, c) => n + c.left, 0)
  const total = all ? round((full * left) / all) : 0
  // Shares add up to the total exactly (the last slot takes any rounding)
  const shares = counts.map((c) => (left ? round((total * c.left) / left) : 0))
  if (shares.length) shares[shares.length - 1] = round(total - shares.slice(0, -1).reduce((a, b) => a + b, 0))
  return { total, full, all, left, shares, proRata: left < all }
}

/** The whole term's price for one player, as if joining at the start (used for the full-year price). */
export function fullTermPrice(program: TermPricingProgram, counts: { all: number }[]) {
  if (isPerTerm(program)) return (program.termPrice ?? TERM_PRICE_DEFAULT) * (counts.length >= 2 ? 1 : 0.5)
  const rate = counts.length >= 2 && program.twoNightPricePerSession != null ? program.twoNightPricePerSession : program.pricePerSession
  if (rate == null) return program.price ?? 0
  return round(rate * counts.reduce((n, c) => n + c.all, 0))
}

/** Full year: the four terms added together, less the discount. */
export function fullYearQuote(termPrices: number[], discountPct: number) {
  const sum = round(termPrices.reduce((a, b) => a + b, 0))
  const pct = Math.min(100, Math.max(0, discountPct))
  const total = round(sum * (1 - pct / 100))
  return { sum, total, saving: round(sum - total), pct }
}

/** "Academy fees do not include the $950 Rowville Eagles player registration." */
export const clubFeeNote = (fee: number | null | undefined) =>
  `Academy fees do not include the $${(fee ?? CLUB_REGISTRATION_FEE_DEFAULT).toLocaleString('en-AU')} Rowville Eagles player registration.`
