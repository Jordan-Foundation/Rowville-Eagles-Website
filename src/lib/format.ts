import { TZ } from './time'

/** Money amounts in reports and totals: $0 shows as "$0" (not "Free", which is for prices families see). */
export const formatMoney = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n || 0)

export const formatAUD = (n: number) =>
  n === 0 ? 'Free' : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n)

export const formatDate = (iso?: string | null, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  iso ? new Intl.DateTimeFormat('en-AU', { timeZone: TZ, ...opts }).format(new Date(iso)) : ''

/** Price as families see it: Academy terms with a per-session price show "$25 / session". */
export const programPriceLabel = (p: { type?: string | null; price?: number | null; pricePerSession?: number | null; twoNightPricePerSession?: number | null; fullCampPrice?: number | null; dayPrice?: number | null; pricingMode?: string | null; termPrice?: number | null }) =>
  p.type === 'academy-term' && p.pricingMode === 'per-term'
    ? `${formatAUD(p.termPrice ?? 400)} / term (2 sessions a week)`
    : p.type === 'holiday-camp' && p.dayPrice != null
    ? `${formatAUD(p.fullCampPrice ?? p.price ?? 0)} full camp · ${formatAUD(p.dayPrice)} / day`
    : p.type === 'academy-term' && p.pricePerSession != null
    ? `${formatAUD(p.pricePerSession)} / session${p.twoNightPricePerSession != null ? ` · 2 nights ${formatAUD(p.twoNightPricePerSession)}` : ''}`
    : formatAUD(p.price ?? 0)

type Priced = { type?: string | null; price?: number | null; pricePerSession?: number | null; twoNightPricePerSession?: number | null; fullCampPrice?: number | null; dayPrice?: number | null; pricingMode?: string | null; termPrice?: number | null; discountPct?: number | null }
const perSession = (p: Priced) => p.pricePerSession != null && (p.type === 'academy-term' || p.type === 'toddler')

/**
 * The headline price for a program card: the lowest of its price options, worked out from the program's
 * own prices so it updates when they change. `from` when there's more than one option (pure — unit tested).
 */
export function cardPrice(p: Priced): { from: boolean; amount: number; unit: string | null } {
  // Camps: from the day price (the full camp is shown on the camp's page)
  if (p.type === 'holiday-camp' && p.dayPrice != null) return { from: true, amount: p.dayPrice, unit: '/ day' }
  if (p.type === 'academy-term' && p.pricingMode === 'per-term') return { from: false, amount: p.termPrice ?? 400, unit: '/ term' }
  if (p.type === 'academy-year') return { from: true, amount: p.price ?? 0, unit: '/ year' }
  if (perSession(p)) {
    const options = [p.pricePerSession!, ...(p.type === 'academy-term' && p.twoNightPricePerSession != null ? [p.twoNightPricePerSession] : [])]
    const amount = Math.min(...options)
    return { from: new Set(options).size > 1, amount, unit: '/ session' }
  }
  return { from: false, amount: p.price ?? 0, unit: null }
}

/** Every price option, for the program's detail page. */
export function priceBreakdown(p: Priced): { label: string; price: string }[] {
  if (p.type === 'academy-term' && p.pricingMode === 'per-term') return [{ label: '2 sessions a week', price: `${formatAUD(p.termPrice ?? 400)} for the term` }, { label: 'Joining late', price: 'pro-rata' }]
  if (p.type === 'academy-year') return [{ label: 'All four terms', price: `${p.discountPct ?? 10}% off` }, { label: 'Paid', price: 'once, upfront' }]
  if (p.type === 'holiday-camp' && p.dayPrice != null) return [{ label: 'Full camp', price: formatAUD(p.fullCampPrice ?? p.price ?? 0) }, { label: 'Single day', price: `${formatAUD(p.dayPrice)} / day` }]
  if (!perSession(p)) return []
  const rows = [{ label: p.type === 'academy-term' ? '1 night a week' : 'Per session', price: `${formatAUD(p.pricePerSession!)} / session` }]
  if (p.type === 'academy-term' && p.twoNightPricePerSession != null) rows.push({ label: '2 nights a week', price: `${formatAUD(p.twoNightPricePerSession)} / session` })
  return rows
}
