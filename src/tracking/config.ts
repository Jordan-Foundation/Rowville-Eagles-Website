/** Ad tracking settings and rules (pure — unit tested). */
export type TrackingConfig = { meta: string | null; google: string[]; ads: string | null; adsLead: string | null; adsPurchase: string | null }

type Stored = { metaPixelId?: string | null; googleTagIds?: string | null; adsLeadLabel?: string | null; adsPurchaseLabel?: string | null } | null | undefined

/**
 * Every Google tag ID in the box, whatever separates them (commas, spaces, new lines, semicolons) and even when pasted
 * with look-alike characters — en/em dashes, full-width commas, non-breaking or zero-width spaces — from Google's pages.
 */
const tidy = (raw: string | null | undefined) =>
  (raw ?? '').normalize('NFKC').replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, '').replace(/[\u2010-\u2015\u2212\uFE58\uFE63]/g, '-').toUpperCase()
export function parseGoogleIds(raw: string | null | undefined): string[] {
  return [...new Set(tidy(raw).match(/(?<![A-Z0-9])(?:AW|G|GT)-[A-Z0-9]+(?![A-Z0-9-])/g) ?? [])]
}
/** Anything in the box that isn't a Google tag ID (shown as an error when saving). */
export function unrecognisedGoogleParts(raw: string | null | undefined): string[] {
  const ids = parseGoogleIds(raw)
  return tidy(raw).split(/[\s,;]+/).map((x) => x.trim()).filter((x) => x && !ids.includes(x))
}

export function trackingConfig(t: Stored): TrackingConfig | null {
  // 472931888098255 is the club's Meta ad account number (entered here once by mistake) — never load it as a pixel
  const meta = t?.metaPixelId?.trim() && /^\d{8,20}$/.test(t.metaPixelId.trim()) && t.metaPixelId.trim() !== '472931888098255' ? t.metaPixelId.trim() : null
  const google = parseGoogleIds(t?.googleTagIds)
  if (!meta && !google.length) return null
  // A label pasted as the whole send_to ("AW-123/AbC") keeps only the part after the "/"
  const label = (x?: string | null) => (x ?? '').normalize('NFKC').replace(/[\s\u200B-\u200D\u2060\uFEFF]/g, '').split('/').pop() || null
  return { meta, google, ads: google.find((g) => g.startsWith('AW-')) ?? null, adsLead: label(t?.adsLeadLabel), adsPurchase: label(t?.adsPurchaseLabel) }
}

/** Live site only: previews and local copies never send anything. */
export const trackingAllowed = (env: Record<string, string | undefined>) => env.VERCEL_ENV === 'production' || env.TRACKING_ALWAYS === 'true'

// Staff areas, and pages whose address is a private link (it would be sent to Meta/Google with the page view)
const PRIVATE = [/^\/refer\//, /^\/reflect(\/|$)/, /^\/cover\//, /^\/management(\/|$)/, /^\/coach(\/|$)/, /^\/camp-coach(\/|$)/, /^\/staff(\/|$)/, /^\/admin(\/|$)/, /^\/invoice\//, /^\/academy\/group\//, /^\/account\/activate/, /^\/unsubscribe/, /^\/selections\/pay\//, /^\/login/, /^\/account\/forgot/, /^\/trial-details\//, /^\/follow-ups\//, /^\/selections\/sheet\//]
const PRIVATE_PARAMS = ['t', 'token', 'link', 'invite', 'code', 'reset', 'resume']

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
