import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/payments'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api', '/cron', '/management', '/coach', '/unsubscribe', '/unsubscribed', '/account', '/checkout', '/shop/cart', '/join/choose', '/join/thanks', '/reflect', '/trial-details', '/follow-ups', '/selections/sheet'] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
