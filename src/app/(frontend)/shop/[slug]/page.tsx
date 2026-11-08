import Link from 'next/link'
import type { Metadata } from 'next'
import { describe, jsonLd, mediaUrl, siteBase } from '@/lib/seo'
import { notFound } from 'next/navigation'
import { payload, formatAUD } from '@/lib/payload'
import { ProductImage } from '@/components/ProductImage'
import { AddToCart } from './AddToCart'
import { ProductGallery } from '@/components/ProductGallery'
import type { Media } from '@/payload-types'
import { currentUser } from '@/lib/auth'
import { itemAccess, shopViewer } from '@/lib/shop-access'
import { foundationSettings } from '@/academy/pdr/load'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { docs } = await (await payload()).find({ pagination: false, collection: 'products', where: { slug: { equals: (await params).slug }, status: { equals: 'active' } }, limit: 1, depth: 1, overrideAccess: true })
  const product = docs[0]
  if (!product) return { title: 'Shop' }
  const image = mediaUrl(product.images?.[0])
  return { title: product.name, description: describe(product.description || `${product.name} — Rowville Eagles club shop.`), alternates: { canonical: `/shop/${product.slug}` }, openGraph: { title: product.name, ...(image ? { images: [image] } : {}) } }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const p = await payload()
  const { docs } = await p.find({ pagination: false, collection: 'products', where: { slug: { equals: slug }, status: { equals: 'active' } }, limit: 1, depth: 1, overrideAccess: true })
  const product = docs[0]
  if (!product) notFound()
  const user = await currentUser()
  const [viewer, fplus] = await Promise.all([shopViewer(p, user?.id), foundationSettings(p)])
  const access = itemAccess(product, viewer, fplus.enabled)
  if (!access) notFound()
  const allowed = access.canBuy
  const teamNames = (product.teams ?? []).map((t) => (typeof t === 'object' ? t.name : null)).filter((n): n is string => Boolean(n))
  const photos = (product.images ?? []).filter((i): i is Media => typeof i === 'object' && Boolean(i?.url)).map((m) => ({ url: m.url!, alt: m.alt, width: m.width ?? 800, height: m.height ?? 800 }))
  const guide = (product.sizeGuide ?? '').split('\n').map((l) => l.split('|').map((c) => c.trim())).filter((r) => r.some(Boolean))
  const sizes = (product.variants ?? []).map((v) => ({ size: v.size, soldOut: typeof v.stock === 'number' && v.stock <= 0 }))

  return (
    <div className="container-x py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ '@context': 'https://schema.org', '@type': 'Product', name: product.name, description: product.description ?? undefined, image: mediaUrl(product.images?.[0]), brand: { '@type': 'Brand', name: product.brand === 'academy' ? 'Rowville Foundation Academy' : 'Rowville Eagles FC' }, offers: { '@type': 'Offer', price: product.price, priceCurrency: 'AUD', availability: 'https://schema.org/InStock', url: `${siteBase()}/shop/${product.slug}` } }) }} />
      <Link href="/shop" className="text-sm text-muted hover:text-ink">← Club Shop</Link>
      <div className="mt-6 grid gap-12 lg:grid-cols-2">
        {photos.length ? (
          <ProductGallery photos={photos} name={product.name} />
        ) : (
          <div className="overflow-hidden rounded-3xl">
            <ProductImage product={product} />
          </div>
        )}
        <div className="lg:pt-6">
          <h1 className="font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase leading-none">{product.name}</h1>
          <p className="mt-4 text-3xl font-semibold">{formatAUD(product.price)}</p>
          {product.description && <p className="mt-6 max-w-prose text-muted">{product.description}</p>}
          <div className="mt-10 max-w-md">
            {allowed ? (
              <AddToCart productId={product.id} slug={product.slug ?? slug} name={product.name} price={product.price} sizes={sizes} />
            ) : (
              <div className={`rounded-2xl border p-6 ${access.foundationPlus ? 'border-[#0B0B0C] bg-[#0B0B0C] text-white' : 'border-line bg-surface-2'}`}>
                <p className="font-semibold"><span aria-hidden>🔒</span> {access.label}</p>
                {access.foundationPlus ? (
                  <>
                    <p className="mt-1 text-sm text-white/70">{user ? `Available to ${fplus.name} members — start a free month or choose a plan to unlock it.` : `Log in if your player is on ${fplus.name}, or join to unlock it.`}</p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link href="/foundation-plus" className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#0B0B0C]">Join {fplus.name}</Link>
                      {!user && <Link href={`/login?next=/shop/${product.slug}`} className="rounded-full border border-white/40 px-5 py-2.5 text-sm font-semibold">Log in</Link>}
                    </div>
                  </>
                ) : teamNames.length ? (
                  <>
                    <p className="mt-1 text-sm text-muted">Team kit for {teamNames.join(', ')}. It unlocks automatically once your player is on the team{user ? ' — if they already are, contact the club' : ' — log in with the account your registration is under'}.</p>
                    {!user && <Link href={`/login?next=/shop/${product.slug}`} className="mt-4 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white">Log in</Link>}
                  </>
                ) : user ? (
                  <p className="mt-1 text-sm text-muted">This item is only available to the players or families it’s been set up for. If you think that’s you, contact the club.</p>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-muted">Log in with the account your registration is under to buy this item.</p>
                    <Link href={`/login?next=/shop/${product.slug}`} className="mt-4 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white">Log in</Link>
                  </>
                )}
              </div>
            )}
          </div>
          {guide.length > 1 && (
            <details className="mt-6 max-w-md rounded-2xl border border-line p-4 text-sm">
              <summary className="cursor-pointer font-semibold">Size guide</summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left">
                  <thead><tr className="text-muted">{guide[0].map((h, i) => <th key={i} className="py-1.5 pr-3 font-medium">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-line">
                    {guide.slice(1).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={`py-1.5 pr-3 ${j === 0 ? 'font-semibold' : ''}`}>{c}</td>)}</tr>)}
                  </tbody>
                </table>
              </div>
            </details>
          )}
          <p className="mt-8 text-xs text-muted">Secure payment by Stripe · Sold by Rowville Foundation Academy on behalf of Rowville Eagles FC.</p>
        </div>
      </div>
    </div>
  )
}
