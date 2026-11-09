import { DownloadCsv } from '@/components/management/DownloadCsv'
import type { Metadata } from 'next'
import Link from 'next/link'
import { requireManagement } from '@/lib/management'
import { payload, formatMoney, formatDate } from '@/lib/payload'
import { discountLabel } from '@/promotions/rules'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Promotions', robots: { index: false } }

export default async function PromotionsPage() {
  await requireManagement('/management/promotions')
  const p = await payload()
  const { docs } = await p.find({ pagination: false, collection: 'promotions', sort: '-createdAt', limit: 100, depth: 0, overrideAccess: true })
  // One query for every promotion's uses
  const { docs: allUses } = docs.length
    ? await p.find({ pagination: false, collection: 'promotion-uses', where: { promotion: { in: docs.map((d) => d.id) }, status: { equals: 'paid' } }, limit: 20000, depth: 0, overrideAccess: true, select: { promotion: true, paidAmount: true } })
    : { docs: [] }
  const stats = docs.map((d) => {
    const uses = allUses.filter((u) => (typeof u.promotion === 'object' ? u.promotion.id : u.promotion) === d.id)
    return { uses: uses.length, paid: uses.reduce((n, u) => n + (u.paidAmount ?? 0), 0) }
  })
  const tone: Record<string, string> = { scheduled: 'bg-sky-100 text-sky-900', live: 'bg-emerald-100 text-emerald-900', draft: 'bg-surface-2 text-muted', ended: 'bg-surface-2 text-muted line-through' }
  return (
    <div className="container-x max-w-4xl py-14">
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">Promotions</h1>
        <div className="mt-3"><DownloadCsv list="promotion-uses" label="Download promotion uses (CSV)" /></div>
        <Link href="/management/promotions/new" className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white">New promotion</Link>
      </div>
      <p className="mt-4 text-muted">A discount for chosen families on anything that costs money — 1-on-1s, camps, programs, Mini Ballers, terms, trials, registrations, tournament fees, shop items and Foundation+. Families who get it see “Your offer” on the booking page and the discount is taken off automatically when they pay.</p>
      {docs.length === 0 ? <p className="mt-8 rounded-2xl border border-line p-6 text-muted">No promotions yet.</p> : (
        <ul className="mt-8 divide-y divide-line rounded-2xl border border-line">
          {docs.map((d, i) => (
            <li key={d.id}>
              <Link href={`/management/promotions/${d.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-surface-2">
                <span>
                  <span className="font-semibold">{d.name}</span> <span className="text-sm text-muted">· {discountLabel(d)}{d.endsAt ? ` · until ${formatDate(d.endsAt, { day: 'numeric', month: 'short' })}` : ''} · {(d.recipients ?? []).length} famil{(d.recipients ?? []).length === 1 ? 'y' : 'ies'}</span>
                  <span className="block text-sm text-muted">{d.sentAt ? `Sent ${formatDate(d.sentAt, { day: 'numeric', month: 'short' })} · ` : d.status === 'scheduled' && d.scheduledFor ? `Sends ${formatDate(d.scheduledFor, { day: 'numeric', month: 'short' })} · ` : ''}Used {stats[i].uses} time{stats[i].uses === 1 ? '' : 's'} · {formatMoney(stats[i].paid)} paid</span>
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${tone[d.status] ?? ''}`}>{d.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
