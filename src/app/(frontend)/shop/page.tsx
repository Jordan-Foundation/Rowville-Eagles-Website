import Link from 'next/link'
import type { Metadata } from 'next'
import { payload, formatAUD } from '@/lib/payload'
import { ProductImage } from '@/components/ProductImage'
import { currentUser } from '@/lib/auth'
import { allowedAudiences } from '@/lib/shop-access'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Club Shop', description: 'Official Rowville Eagles and RFA playing kit, training wear and apparel.' }

const categories = { kit: 'Playing kit', training: 'Training wear', apparel: 'Supporter apparel', accessories: 'Accessories' } as const

export default async function ShopPage() {
  const p = await payload()
  const user = await currentUser()
  const audiences = await allowedAudiences(p, user?.id)
  const { docs } = await p.find({ collection: 'products', where: { status: { equals: 'active' }, audience: { in: audiences } }, depth: 1, limit: 100 })
  const notice = !user
    ? { text: 'Registered Rowville and RFA players: log in to see team kit and training wear.', href: '/login?next=/shop', cta: 'Log in' }
    : audiences.length === 1
      ? { text: 'Team kit appears here once your player’s registration is confirmed.', href: '/account', cta: 'My account' }
      : null
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
        {notice && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface-2 px-6 py-4">
            <p className="text-sm">{notice.text}</p>
            <Link href={notice.href} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white">{notice.cta}</Link>
          </div>
        )}
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
