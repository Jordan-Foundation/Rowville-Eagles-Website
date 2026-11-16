import Link from 'next/link'
import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { localYmd } from '@/lib/time'
import { formatMoney } from '@/lib/format'
import { requireFinance } from '@/finance/access'
import { addDays, mondayOf, pctOf, r2 } from '@/finance/rules'
import { attentionItems, expensesFor, revenueFor } from '@/finance/report'
import { periodPay } from '@/finance/pay'
import { sendReportNow } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Finance', robots: { index: false } }

const btn = 'min-h-9 border border-line px-3 text-xs font-semibold uppercase tracking-[0.1em]'
const day = (ymd: string) => new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${ymd}T00:00:00Z`))

/** Key numbers for a week or a month: revenue, coaching cost, expenses, net — plus what needs attention and past reports. */
export default async function FinanceOverview({ searchParams }: { searchParams: Promise<{ view?: string; m?: string; done?: string; error?: string }> }) {
  await requireFinance('/management/finance')
  const sp = await searchParams
  const p = await payload()
  const today = localYmd(new Date())
  const thisWeek = mondayOf(today)
  let from: string
  let to: string
  let label: string
  if (sp.m && /^\d{4}-\d{2}$/.test(sp.m)) {
    from = `${sp.m}-01`
    to = addDays(`${sp.m.slice(0, 4)}-${String(Number(sp.m.slice(5)) % 12 + 1).padStart(2, '0')}-01`.replace(/^(\d{4})-01-01$/, (_, y) => `${Number(y) + 1}-01-01`), -1)
    label = new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${from}T00:00:00Z`))
  } else {
    from = mondayOf(sp.view && /^\d{4}-\d{2}-\d{2}$/.test(sp.view) ? sp.view : addDays(thisWeek, -7))
    to = addDays(from, 6)
    label = `Week ${day(from)} – ${day(to)}`
  }
  const [revenue, pay, expenses, attention, { docs: reports }] = await Promise.all([
    revenueFor(p, from, to), periodPay(p, from, to), expensesFor(p, from, to), attentionItems(p),
    p.find({ collection: 'finance-reports', sort: '-periodStart', limit: 12, depth: 0, overrideAccess: true }),
  ])
  const net = r2(revenue.net - pay.totals.total - expenses.total)
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(`${today.slice(0, 7)}-15T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - i); return d.toISOString().slice(0, 7) })
  const kpi = (l: string, v: string, sub?: string, tone?: string) => <div className="panel border border-line p-4"><p className="text-xs text-muted">{l}</p><p className={`mt-1 text-2xl font-bold tabular-nums ${tone ?? ''}`}>{v}</p>{sub && <p className="text-xs text-muted">{sub}</p>}</div>
  return (
    <div className="space-y-8">
      {sp.done && <p role="status" className="border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm">{sp.done}</p>}
      {sp.error && <p role="alert" className="border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm">{sp.error}</p>}
      <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Period">
        <Link className={btn} href={`/management/finance?view=${thisWeek}`}>This week</Link>
        <Link className={btn} href="/management/finance">Last week</Link>
        <Link className={btn} href={`/management/finance?view=${addDays(from, -7)}`}>← Week before</Link>
        {months.map((m) => <Link key={m} className={btn} href={`/management/finance?m=${m}`}>{new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', month: 'short', year: '2-digit' }).format(new Date(`${m}-15T00:00:00Z`))}</Link>)}
      </nav>
      <h2 className="font-display text-2xl font-semibold uppercase">{label}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-kpis>
        {kpi('Revenue (net of refunds)', formatMoney(revenue.net), `${formatMoney(revenue.refunds)} refunded`)}
        {kpi('Coaching cost', formatMoney(pay.totals.total), `${pay.totals.hours.toFixed(1)} hours · ${pctOf(pay.totals.total, revenue.net) ?? '—'}% of revenue`)}
        {kpi('Expenses', formatMoney(expenses.total), `${expenses.count} recorded`)}
        {kpi('Net result', formatMoney(net), undefined, net < 0 ? 'text-red-400' : '')}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel border border-line p-5 text-sm" aria-label="Revenue by program">
          <h3 className="font-semibold">Revenue by program</h3>
          <ul className="mt-2 divide-y divide-line">{revenue.lines.map((l) => <li key={l.label} className="flex justify-between gap-3 py-2"><span>{l.label}</span><span className="tabular-nums">{formatMoney(l.net)}</span></li>)}{!revenue.lines.length && <li className="py-2 text-muted">No payments.</li>}</ul>
          <Link href="/management/finance/income" className="mt-2 inline-block text-xs underline">Full income summary →</Link>
        </section>
        <section className="panel border border-line p-5 text-sm" aria-label="Needs attention">
          <h3 className="font-semibold">Needs attention</h3>
          <ul className="mt-2 space-y-2">
            <li><Link className="underline" href="/management/finance/expenses?tab=missing">{attention.unmatchedDebits} bank debit{attention.unmatchedDebits === 1 ? '' : 's'} without a receipt</Link></li>
            <li><Link className="underline" href="/management/finance/expenses?status=needs_review">{attention.needsReview} expense{attention.needsReview === 1 ? '' : 's'} to review</Link></li>
            <li>{attention.missingReceipts} expense{attention.missingReceipts === 1 ? '' : 's'} missing a receipt file</li>
          </ul>
        </section>
      </div>
      <section className="panel space-y-3 border border-line p-5 text-sm" aria-label="Weekly reports">
        <h3 className="font-semibold">Weekly reports</h3>
        <p className="text-muted">Emailed every Monday at 9am (Melbourne) for the week before, with the coach pay spreadsheet attached. Change who gets it in Settings.</p>
        <ul className="divide-y divide-line" data-reports>{reports.map((r) => <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2"><Link className="underline" href={`/management/finance?view=${r.periodStart}`}>Week of {day(r.periodStart)}</Link><span className="text-muted">sent {r.sentAt ? new Date(r.sentAt).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—'} · {r.sentTo}</span></li>)}{!reports.length && <li className="py-2 text-muted">No reports yet.</li>}</ul>
        <form action={sendReportNow} className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1">Week (any day in it)<input type="date" name="week" defaultValue={sp.m ? addDays(thisWeek, -7) : from} className="min-h-9 border border-line bg-surface px-2" /></label>
          <label className="flex items-center gap-2"><input type="checkbox" name="onlyMe" /> Just send it to me</label>
          <button className={btn}>Send report now</button>
        </form>
      </section>
    </div>
  )
}
