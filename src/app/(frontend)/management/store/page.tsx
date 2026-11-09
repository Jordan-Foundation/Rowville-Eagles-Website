import Link from 'next/link'
import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { payload, formatDate } from '@/lib/payload'
import { formatMoney } from '@/lib/format'
import { DownloadCsv } from '@/components/management/DownloadCsv'
import { setOrderStatus } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Store', robots: { index: false } }

const LOW = 3

/** Shop orders to pack and hand over, and items running low. */
export default async function StorePage() {
  await requireManagement('/management/store')
  const p = await payload()
  const [{ docs: todo }, { docs: recent }, { docs: products }] = await Promise.all([
    p.find({ pagination: false, collection: 'orders', where: { status: { in: ['paid', 'ready'] } }, sort: 'createdAt', limit: 200, depth: 0, overrideAccess: true }),
    p.find({ pagination: false, collection: 'orders', where: { status: { in: ['completed', 'refunded', 'cancelled'] } }, sort: '-updatedAt', limit: 20, depth: 0, overrideAccess: true }),
    p.find({ pagination: false, collection: 'products', where: { status: { equals: 'active' } }, limit: 300, depth: 0, overrideAccess: true }),
  ])
  const low = products.flatMap((pr) => (pr.variants ?? []).filter((v) => typeof v.stock === 'number' && v.stock <= LOW).map((v) => ({ product: pr, size: v.size, stock: v.stock! })))
  const btn = 'min-h-10 border border-line px-3 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white'
  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Store</h1>
        <p className="mt-2 text-muted">Pack paid orders, mark them ready (the family is emailed), then completed once handed over or posted.</p>
        <div className="mt-3 flex flex-wrap gap-2"><DownloadCsv list="orders" label="All orders (CSV)" /><Link href="/admin/collections/products" className={`${btn} inline-flex items-center`}>Edit shop items</Link></div>
      </div>
      <section aria-label="Orders to fulfil" className="panel border border-line">
        <h2 className="border-b border-line px-5 py-3 font-display text-xl font-semibold uppercase">To fulfil ({todo.length})</h2>
        {todo.length === 0 ? <p className="px-5 py-4 text-sm text-muted">Nothing waiting.</p> : (
          <ul className="divide-y divide-line">
            {todo.map((o) => (
              <li key={o.id} className="grid gap-3 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <p className="font-semibold">{o.reference} · {o.contact.name} <span className="font-normal text-muted">· {formatDate(o.createdAt, { day: 'numeric', month: 'short' })} · {o.fulfilment === 'post' ? 'Post' : 'Pickup'} · {formatMoney(o.total)}</span></p>
                  <ul className="mt-1 text-sm">{(o.items ?? []).map((i) => <li key={i.id}>{i.quantity ?? 1} × {i.name}{i.size ? ` (${i.size})` : ''}</li>)}</ul>
                  {o.fulfilment === 'post' && o.shippingAddress && <p className="mt-1 whitespace-pre-line text-xs text-muted">{o.shippingAddress}</p>}
                  {o.notes && <p className="mt-1 text-xs text-muted">Note: {o.notes}</p>}
                </div>
                <form action={setOrderStatus} className="flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={o.id} />
                  {o.status === 'paid' && <button name="to" value="ready" className={btn}>{o.fulfilment === 'post' ? 'Posted' : 'Ready to collect'}</button>}
                  <button name="to" value="completed" className={btn}>Completed</button>
                  {o.status === 'ready' && <span className="self-center text-xs text-emerald-300">Family told</span>}
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-label="Low stock" className="panel border border-line">
        <h2 className="border-b border-line px-5 py-3 font-display text-xl font-semibold uppercase">Low stock ({low.length})</h2>
        {low.length === 0 ? <p className="px-5 py-4 text-sm text-muted">Nothing at {LOW} or fewer.</p> : (
          <ul className="divide-y divide-line text-sm">
            {low.map((l) => <li key={`${l.product.id}-${l.size}`}><Link href={`/admin/collections/products/${l.product.id}`} className="flex justify-between px-5 py-3 hover:bg-white/5"><span>{l.product.name} · {l.size}</span><span className={l.stock === 0 ? 'font-semibold text-red-300' : 'text-amber-300'}>{l.stock === 0 ? 'Sold out' : `${l.stock} left`}</span></Link></li>)}
          </ul>
        )}
      </section>
      <section aria-label="Recent orders" className="panel border border-line">
        <h2 className="border-b border-line px-5 py-3 font-display text-xl font-semibold uppercase">Recently finished</h2>
        <ul className="divide-y divide-line text-sm">{recent.map((o) => <li key={o.id} className="px-5 py-3">{o.reference} · {o.contact.name} <span className="text-muted">· {o.status} · {formatMoney(o.total)}</span></li>)}</ul>
      </section>
    </div>
  )
}
