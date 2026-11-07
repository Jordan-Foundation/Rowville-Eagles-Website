import type { MetadataRoute } from 'next'
import { payload } from '@/lib/payload'
import { siteUrl } from '@/lib/payments'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  const p = await payload()
  const [posts, programs, products] = await Promise.all([
    p.find({ collection: 'posts', where: { status: { equals: 'published' } }, limit: 500, depth: 0, select: { slug: true, updatedAt: true } }),
    p.find({ collection: 'programs', where: { status: { in: ['open', 'full'] }, type: { not_in: ['registration', 'academy-trial', 'private-session'] } }, limit: 200, depth: 0, select: { slug: true, updatedAt: true } }),
    p.find({ collection: 'products', where: { status: { equals: 'active' }, audiences: { contains: 'everyone' } }, limit: 200, depth: 0, select: { slug: true, updatedAt: true } }),
  ])
  const pages = ['', '/join', '/about', '/what-makes-us-different', '/foundation-plus', '/programs', '/academy', '/academy/trial', '/academy/1-on-1', '/shop', '/news', '/sponsors']
  return [
    ...pages.map((path) => ({ url: `${base}${path}`, changeFrequency: 'weekly' as const, priority: path === '' ? 1 : 0.8 })),
    ...posts.docs.map((d) => ({ url: `${base}/news/${d.slug}`, lastModified: d.updatedAt, priority: 0.6 })),
    ...programs.docs.map((d) => ({ url: `${base}/programs/${d.slug}`, lastModified: d.updatedAt, priority: 0.7 })),
    ...products.docs.map((d) => ({ url: `${base}/shop/${d.slug}`, lastModified: d.updatedAt, priority: 0.5 })),
  ]
}
