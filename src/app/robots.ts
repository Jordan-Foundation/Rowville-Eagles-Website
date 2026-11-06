import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/payments'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api', '/cron', '/staff', '/coach', '/unsubscribe', '/unsubscribed', '/account', '/checkout', '/shop/cart', '/join/choose', '/join/thanks'] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
