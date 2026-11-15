/** Ad tracking settings and rules (pure — unit tested). */
export type TrackingConfig = { meta: string | null; google: string[]; ads: string | null; adsLead: string | null; adsPurchase: string | null }

type Stored = { metaPixelId?: string | null; googleTagIds?: string | null; adsLeadLabel?: string | null; adsPurchaseLabel?: string | null } | null | undefined

export function trackingConfig(t: Stored): TrackingConfig | null {
  const meta = t?.metaPixelId?.trim() && /^\d{8,20}$/.test(t.metaPixelId.trim()) ? t.metaPixelId.trim() : null
  const google = (t?.googleTagIds ?? '').split(',').map((x) => x.trim().toUpperCase()).filter((x) => /^(AW|G|GT)-[A-Z0-9]+$/.test(x))
  if (!meta && !google.length) return null
  return { meta, google, ads: google.find((g) => g.startsWith('AW-')) ?? null, adsLead: t?.adsLeadLabel?.trim() || null, adsPurchase: t?.adsPurchaseLabel?.trim() || null }
}

/** Live site only: previews and local copies never send anything. */
export const trackingAllowed = (env: Record<string, string | undefined>) => env.VERCEL_ENV === 'production' || env.TRACKING_ALWAYS === 'true'

// Staff areas, and pages whose address is a private link (it would be sent to Meta/Google with the page view)
const PRIVATE = [/^\/management(\/|$)/, /^\/coach(\/|$)/, /^\/camp-coach(\/|$)/, /^\/staff(\/|$)/, /^\/admin(\/|$)/, /^\/invoice\//, /^\/academy\/group\//, /^\/account\/activate/, /^\/unsubscribe/, /^\/selections\/pay\//, /^\/login/, /^\/account\/forgot/]
const PRIVATE_PARAMS = ['t', 'token', 'link', 'invite', 'code', 'reset']

export function isTrackable(pathname: string, search: URLSearchParams | null) {
  if (PRIVATE.some((r) => r.test(pathname))) return false
  return !PRIVATE_PARAMS.some((k) => search?.has(k))
}

/** What a confirmation page reports: a lead (free trial, enquiry) or a purchase (paid booking), never personal details. */
export type Conversion = { kind: 'lead' | 'purchase'; category: string; value: number; ref: string }

export const conversionFor = (o: { category: string; amount: number; ref: string; lead?: boolean }): Conversion => ({
  kind: o.lead || !(o.amount > 0) ? 'lead' : 'purchase',
  category: o.category,
  value: Math.max(0, Math.round((o.amount || 0) * 100) / 100),
  ref: o.ref,
})

/** Booking category for reports: trial / camp / academy-term / club-registration / tournament / program. */
export function bookingCategory(b: { bookingType?: string | null }, programType?: string | null) {
  if (b.bookingType === 'trial') return 'trial'
  if (programType === 'holiday-camp') return 'camp'
  if (programType === 'academy-term' || programType === 'academy-year' || programType === 'toddler') return 'academy-term'
  if (programType === 'registration') return 'club-registration'
  if (programType === 'tournament') return 'tournament'
  return 'program'
}
