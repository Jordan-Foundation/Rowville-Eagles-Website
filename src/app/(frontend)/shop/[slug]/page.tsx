import Link from 'next/link'
import { notFound } from 'next/navigation'
import { payload, formatAUD } from '@/lib/payload'
import { ProductImage } from '@/components/ProductImage'
import { AddToCart } from './AddToCart'
import { currentUser } from '@/lib/auth'
import { allowedAudiences } from '@/lib/shop-access'

export const dynamic = 'force-dynamic'

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const p = await payload()
  const { docs } = await p.find({ collection: 'products', where: { slug: { equals: slug }, status: { equals: 'active' } }, limit: 1, depth: 1 })
  const product = docs[0]
  if (!product) notFound()
  const user = await currentUser()
  const allowed = (await allowedAudiences(p, user?.id)).includes(product.audience)
  const sizes = (product.variants ?? []).map((v) => ({ size: v.size, soldOut: typeof v.stock === 'number' && v.stock <= 0 }))

  return (
    <div className="container-x py-12">
      <Link href="/shop" className="text-sm text-muted hover:text-ink">← Club Shop</Link>
      <div className="mt-6 grid gap-12 lg:grid-cols-2">
        <div className="overflow-hidden rounded-3xl">
          <ProductImage product={product} />
        </div>
        <div className="lg:pt-6">
          <h1 className="font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase leading-none">{product.name}</h1>
          <p className="mt-4 text-3xl font-semibold">{formatAUD(product.price)}</p>
          {product.description && <p className="mt-6 max-w-prose text-muted">{product.description}</p>}
          <div className="mt-10 max-w-md">
            {allowed ? (
              <AddToCart productId={product.id} slug={product.slug} name={product.name} price={product.price} sizes={sizes} />
            ) : (
              <div className="rounded-2xl border border-line bg-surface-2 p-6">
                <p className="font-semibold">{product.audience === 'rfa' ? 'For RFA players' : 'For registered Rowville players'}</p>
                <p className="mt-1 text-sm text-muted">Log in with the account your registration is under to buy this item.</p>
                <Link href={`/login?next=/shop/${product.slug}`} className="mt-4 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white">Log in</Link>
              </div>
            )}
          </div>
          <p className="mt-8 text-xs text-muted">Secure payment by Stripe · Sold by Rowville Foundation Academy on behalf of Rowville Eagles FC.</p>
        </div>
      </div>
    </div>
  )
}
