import type { Media } from '@/payload-types'

/** The site's public address (used for absolute links in share cards and structured data). */
export const siteBase = () =>
  process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://www.rowvilleeagles.com.au')

/** Absolute URL of an uploaded image, if any. */
export function mediaUrl(m: unknown): string | undefined {
  const url = m && typeof m === 'object' ? (m as Media).url : undefined
  if (!url) return undefined
  return url.startsWith('http') ? url : `${siteBase()}${url}`
}

/** Plain text for meta descriptions (≤ 160 characters, whole words). */
export function describe(text: string | null | undefined, max = 160) {
  const t = (text ?? '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).replace(/\s+\S*$/, '')}…`
}

/** <script type="application/ld+json"> contents, safe to embed. */
export const jsonLd = (data: object) => JSON.stringify(data).replace(/</g, '\\u003c')
