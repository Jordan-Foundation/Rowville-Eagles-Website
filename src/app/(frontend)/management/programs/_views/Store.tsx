import Link from 'next/link'
import { payload, formatMoney, formatDate } from '@/lib/payload'
import type { Product } from '@/payload-types'
import { FilterBar, Heading, KpiTiles, selectCls, thCls } from '../_ui'

const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null))
const LOW = 3
const categories = { kit: 'Playing kit', training: 'Training wear', apparel: 'Supporter apparel', accessories: 'Accessories' } as const

/** Store: orders, revenue, what's waiting to be fulfilled, Foundation+-only sales and low stock. */
export async function StoreView({ q }: { q: Record<string, string | undefined> }) {
  const p = await payload()
  const from = q.from || new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10)
  const to = q.to || new Date().toISOString().slice(0, 10)
  const [{ docs: orders }, { docs: products }] = await Promise.all([
    p.find({ pagination: false, collection: 'orders', where: { createdAt: { greater_than_equal: `${from}T00:00:00+10:00`, less_than_equal: `${to}T23:59:59+10:00` }, status: { in: ['paid', 'ready', 'completed', 'refunded'] } }, limit: 5000, depth: 0, overrideAccess: true, sort: '-createdAt' }),
    p.find({ pagination: false, collection: 'products', limit: 1000, depth: 0, overrideAccess: true }),
  ])
  const byId = new Map(products.map((x) => [x.id, x as Product]))
  const inCat = (pid: number | null) => !q.category || byId.get(pid ?? -1)?.category === q.category
  const lines = orders.flatMap((o) => (o.items ?? []).map((i) => ({ o, i, product: rel(i.product) }))).filter((l) => inCat(l.product))
  const kept = lines.filter((l) => l.o.status !== 'refunded')
  const revenue = kept.reduce((n, l) => n + (l.i.unitPrice ?? 0) * (l.i.quantity ?? 0), 0)
  const fplus = kept.filter((l) => ((byId.get(l.product ?? -1)?.audiences ?? []) as string[]).includes('foundation-plus'))
  const toFulfil = orders.filter((o) => o.status === 'paid' && (o.items ?? []).some((i) => inCat(rel(i.product))))
  const low = products
    .filter((x) => x.status === 'active' && (!q.category || x.category === q.category))
    .flatMap((x) => (x.variants ?? []).filter((v) => typeof v.stock === 'number' && v.stock <= LOW).map((v) => ({ product: x, size: v.size, stock: v.stock! })))
  const tiles: [string, string, string?][] = [
    ['Orders', String(new Set(kept.map((l) => l.o.id)).size), `${formatDate(from)} – ${formatDate(to)}`],
    ['Revenue', formatMoney(revenue), `${kept.reduce((n, l) => n + (l.i.quantity ?? 0), 0)} items sold`],
    ['To fulfil', String(toFulfil.length), toFulfil.length ? 'paid, not yet ready' : 'all caught up'],
    ['Foundation+-only sales', String(fplus.reduce((n, l) => n + (l.i.quantity ?? 0), 0)), formatMoney(fplus.reduce((n, l) => n + (l.i.unitPrice ?? 0) * (l.i.quantity ?? 0), 0))],
    ['Low stock', String(low.length), `sizes with ${LOW} or fewer left`],
    ['Refunded', String(orders.filter((o) => o.status === 'refunded').length), 'orders in this period'],
  ]
  return (
    <div className="space-y-10">
      <Heading title="Store" sub="Orders, revenue and stock" links={[{ href: '/admin/collections/orders', label: 'All orders' }, { href: '/admin/collections/products', label: 'Products' }]} />
      <FilterBar program="store">
        <label className="text-xs text-muted">From<input type="date" name="from" defaultValue={from} className={selectCls} /></label>
        <label className="text-xs text-muted">To<input type="date" name="to" defaultValue={to} className={selectCls} /></label>
        <label className="text-xs text-muted">Category<select name="category" defaultValue={q.category ?? ''} className={selectCls}><option value="">All categories</option>{Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </FilterBar>
      <KpiTiles tiles={tiles} />
      <section className="grid gap-10 lg:grid-cols-2">
        <div>
          <h3 className="font-display text-2xl font-semibold uppercase">To fulfil</h3>
          {toFulfil.length === 0 ? <p className="mt-3 text-sm text-muted">Nothing waiting.</p> : (
            <ul className="mt-4 divide-y divide-line border border-line text-sm">
              {toFulfil.slice(0, 30).map((o) => (
                <li key={o.id}><Link href={`/admin/collections/orders/${o.id}`} className="flex justify-between gap-3 px-4 py-3 hover:bg-white/5"><span>{o.reference} · {o.contact.name} · {o.fulfilment === 'post' ? 'post' : 'pick up'}</span><span className="tabular-nums">{formatMoney(o.total)}</span></Link></li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="font-display text-2xl font-semibold uppercase">Low stock</h3>
          {low.length === 0 ? <p className="mt-3 text-sm text-muted">No sizes running low.</p> : (
            <table className="mt-4 w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wider text-muted"><tr><th className={thCls}>Item</th><th className={thCls}>Size</th><th className={thCls}>Left</th></tr></thead>
              <tbody className="divide-y divide-line">
                {low.map((l) => <tr key={`${l.product.id}-${l.size}`}><td className="py-3 pr-4"><Link href={`/admin/collections/products/${l.product.id}`} className="hover:underline">{l.product.name}</Link></td><td className="pr-4">{l.size}</td><td className={`tabular-nums ${l.stock === 0 ? 'text-red-300' : 'text-amber-300'}`}>{l.stock === 0 ? 'Sold out' : l.stock}</td></tr>)}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
