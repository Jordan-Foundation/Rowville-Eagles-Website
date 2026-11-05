import Link from 'next/link'
import { notFound } from 'next/navigation'
import { payload, formatAUD } from '@/lib/payload'
import { ProductImage } from '@/components/ProductImage'
import { AddToCart } from './AddToCart'

export const revalidate = 30

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { docs } = await (await payload()).find({ collection: 'products', where: { slug: { equals: slug }, status: { equals: 'active' } }, limit: 1, depth: 1 })
  const product = docs[0]
  if (!product) notFound()
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
            <AddToCart productId={product.id} slug={product.slug} name={product.name} price={product.price} sizes={sizes} />
          </div>
          <p className="mt-8 text-xs text-muted">Secure payment by Stripe · Sold by Rowville Foundation Academy on behalf of Rowville Eagles FC.</p>
        </div>
      </div>
    </div>
  )
}
