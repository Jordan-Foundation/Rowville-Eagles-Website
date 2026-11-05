import Link from 'next/link'
import type { Metadata } from 'next'
import { payload, formatAUD } from '@/lib/payload'
import { ProductImage } from '@/components/ProductImage'

export const revalidate = 60
export const metadata: Metadata = { title: 'Club Shop', description: 'Official Rowville Eagles and RFA playing kit, training wear and apparel.' }

const categories = { kit: 'Playing kit', training: 'Training wear', apparel: 'Supporter apparel', accessories: 'Accessories' } as const

export default async function ShopPage() {
  const { docs } = await (await payload()).find({ collection: 'products', where: { status: { equals: 'active' } }, depth: 1, limit: 100 })
  const groups = (Object.keys(categories) as (keyof typeof categories)[])
    .map((c) => ({ c, items: docs.filter((d) => d.category === c) }))
    .filter((g) => g.items.length)

  return (
    <>
      <section className="pitch-lines bg-[#0f2a55] text-white">
        <div className="container-x flex flex-wrap items-end justify-between gap-6 py-16">
          <div>
            <p className="eyebrow">Official merchandise</p>
            <h1 className="mt-3 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase sm:text-6xl">Club Shop</h1>
            <p className="mt-4 max-w-xl text-white/70">Playing kit, training wear and supporter gear. Pick up at the club or have it posted.</p>
          </div>
          <Link href="/shop/cart" className="rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold hover:bg-white/10">View cart →</Link>
        </div>
      </section>
      <div className="container-x space-y-16 py-14">
        {groups.map((g) => (
          <section key={g.c}>
            <h2 className="font-[family-name:var(--font-barlow)] text-3xl font-bold uppercase">{categories[g.c]}</h2>
            <div className="mt-6 grid grid-cols-2 gap-5 lg:grid-cols-4">
              {g.items.map((p) => (
                <Link key={p.id} href={`/shop/${p.slug}`} className="group">
                  <div className="overflow-hidden rounded-2xl">
                    <ProductImage product={p} className="transition duration-500 group-hover:scale-[1.03]" />
                  </div>
                  <h3 className="mt-3 font-semibold group-hover:text-brand">{p.name}</h3>
                  <p className="text-sm text-muted">{formatAUD(p.price)}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
        {groups.length === 0 && <p className="text-muted">The shop is being stocked — check back soon.</p>}
      </div>
    </>
  )
}
