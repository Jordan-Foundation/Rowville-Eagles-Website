import { TZ } from './time'

export const formatAUD = (n: number) =>
  n === 0 ? 'Free' : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n)

export const formatDate = (iso?: string | null, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  iso ? new Intl.DateTimeFormat('en-AU', { timeZone: TZ, ...opts }).format(new Date(iso)) : ''

/** Price as families see it: Academy terms with a per-session price show "$25 / session". */
export const programPriceLabel = (p: { type?: string | null; price?: number | null; pricePerSession?: number | null; twoNightPricePerSession?: number | null }) =>
  p.type === 'academy-term' && p.pricePerSession != null
    ? `${formatAUD(p.pricePerSession)} / session${p.twoNightPricePerSession != null ? ` · 2 nights ${formatAUD(p.twoNightPricePerSession)}` : ''}`
    : formatAUD(p.price ?? 0)
