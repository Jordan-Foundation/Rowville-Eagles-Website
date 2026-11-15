import Link from 'next/link'
import type { Metadata } from 'next'
import type { Where } from 'payload'
import { requireManagement } from '@/lib/management'
import { payload, formatDate } from '@/lib/payload'
import { formatMoney } from '@/lib/format'
import { localYmd } from '@/lib/time'
import { INVOICE_STATUS as STATUS_LABEL, isOverdue } from '@/invoices/totals'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Invoices', robots: { index: false } }

const TABS = [
  { key: 'unpaid', label: 'Unpaid', where: { status: { in: ['draft', 'sent'] } } },
  { key: 'paid', label: 'Paid', where: { status: { in: ['paid', 'refunded'] } } },
  { key: 'all', label: 'All', where: {} },
] as const

/** Invoices for anything charged after the fact — with a private pay link for each family. */
export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireManagement('/management/invoices')
  const sp = await searchParams
  const tab = TABS.find((t) => t.key === sp.show) ?? TABS[0]
  const p = await payload()
  const [{ docs }, unpaid] = await Promise.all([
    p.find({ collection: 'invoices', where: tab.where as Where, sort: '-createdAt', limit: 200, pagination: false, depth: 0, overrideAccess: true }),
    p.find({ collection: 'invoices', where: { status: { equals: 'sent' } }, limit: 2000, pagination: false, depth: 0, overrideAccess: true, select: { total: true, dueDate: true, status: true } }),
  ])
  const today = localYmd(new Date())
  const owed = unpaid.docs.reduce((n, d) => n + (d.total ?? 0), 0)
  const overdue = unpaid.docs.filter((d) => isOverdue(d, today, localYmd))
  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Invoices</h1>
          <p className="mt-2 max-w-3xl text-muted">Charge a family after the fact — a one-off session, a shop item, a program or anything else. They get an email and/or text with a link to pay by card. One reminder goes automatically the day after it’s due.</p>
        </div>
        <Link href="/management/invoices/new" className="inline-flex min-h-10 items-center bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-black">New invoice</Link>
      </div>
      <dl className="panel grid gap-4 border border-line p-5 text-sm sm:grid-cols-3">
        <div><dt className="text-muted">Waiting for payment</dt><dd className="font-display text-2xl font-semibold">{unpaid.docs.length}</dd></div>
        <div><dt className="text-muted">Owed</dt><dd className="font-display text-2xl font-semibold">{formatMoney(owed)}</dd></div>
        <div><dt className="text-muted">Overdue</dt><dd className={`font-display text-2xl font-semibold ${overdue.length ? 'text-amber-300' : ''}`}>{overdue.length}</dd></div>
      </dl>
      <nav aria-label="Show" className="flex flex-wrap gap-2">
        {TABS.map((t) => <Link key={t.key} href={`/management/invoices?show=${t.key}`} aria-current={t.key === tab.key ? 'page' : undefined} className={`min-h-10 border px-3 py-2 text-sm ${t.key === tab.key ? 'border-white bg-white text-black' : 'border-line text-muted hover:text-ink'}`}>{t.label}</Link>)}
      </nav>
      <ul className="divide-y divide-line border border-line" aria-label="Invoices">
        {docs.map((d) => {
          const late = isOverdue(d, today, localYmd)
          return (
            <li key={d.id}>
              <Link href={`/management/invoices/${d.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-white/5">
                <span>
                  <span className="font-semibold">{d.contactName}</span> <span className="text-muted">· {d.reference}</span>
                  <span className="block text-sm text-muted">{(d.items ?? []).map((l) => l.description).join(', ').slice(0, 90)} · {formatDate(d.createdAt, { day: 'numeric', month: 'short' })}{d.dueDate ? ` · due ${formatDate(d.dueDate, { day: 'numeric', month: 'short' })}` : ''}</span>
                </span>
                <span className="text-right">
                  <span className="block font-semibold">{formatMoney(d.total ?? 0)}</span>
                  <span className={`text-sm ${late ? 'font-semibold text-amber-300' : 'text-muted'}`}>{late ? 'Overdue' : STATUS_LABEL[d.status]}</span>
                </span>
              </Link>
            </li>
          )
        })}
        {docs.length === 0 && <li className="p-4 text-sm text-muted">{tab.key === 'unpaid' ? 'Nothing waiting for payment.' : 'No invoices yet.'}</li>}
      </ul>
    </div>
  )
}
