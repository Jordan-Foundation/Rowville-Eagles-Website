import Link from 'next/link'
import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { payload, formatDate } from '@/lib/payload'
import { formatMoney } from '@/lib/format'
import { CATEGORY_LABEL, moneyEntries, summarise } from '@/lib/money'
import { localToUtc, localYmd } from '@/lib/time'
import { DownloadCsv } from '@/components/management/DownloadCsv'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Money', robots: { index: false } }

const monthBounds = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: localToUtc(`${ym}-01`, '00:00').toISOString(), to: localToUtc(`${ym}-${String(last).padStart(2, '0')}`, '23:59').toISOString() }
}

/** A month or a term at a glance, split by program and by Stripe account — to match against Stripe payouts. */
export default async function MoneyPage({ searchParams }: { searchParams: Promise<{ m?: string; term?: string }> }) {
  await requireManagement('/management/money')
  const sp = await searchParams
  const p = await payload()
  const thisMonth = localYmd(new Date()).slice(0, 7)
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setUTCDate(15); d.setUTCMonth(d.getUTCMonth() - i); return d.toISOString().slice(0, 7) })
  const { docs: terms } = await p.find({ pagination: false, collection: 'academy-terms', sort: '-startDate', limit: 12, depth: 0, overrideAccess: true })
  const term = sp.term ? terms.find((t) => String(t.id) === sp.term) : null
  const ym = /^\d{4}-\d{2}$/.test(sp.m ?? '') ? sp.m! : thisMonth
  const range = term ? { from: term.startDate, to: term.endDate } : monthBounds(ym)
  const label = term ? term.name : formatDate(`${ym}-15T00:00:00Z`, { month: 'long', year: 'numeric' })
  const s = summarise(await moneyEntries(p, new Date(Date.parse(range.from) - 400 * 86_400_000).toISOString()), range.from, range.to)
  const tab = (active: boolean) => `min-h-10 border px-3 py-2 text-sm ${active ? 'border-white bg-white text-black' : 'border-line text-muted hover:text-ink'}`
  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Money · {label}</h1>
        <p className="mt-2 text-muted">Card payments taken on the website, by program and by Stripe account. {formatDate(range.from, { day: 'numeric', month: 'short', year: 'numeric' })} – {formatDate(range.to, { day: 'numeric', month: 'short', year: 'numeric' })}, Melbourne time.</p>
      </div>
      <form className="flex flex-wrap items-end gap-3 text-sm">
        <label>Month
          <select name="m" defaultValue={term ? '' : ym} className="mt-1 block min-h-10 border border-line bg-black/40 px-3">
            {months.map((m) => <option key={m} value={m}>{formatDate(`${m}-15T00:00:00Z`, { month: 'long', year: 'numeric' })}</option>)}
          </select>
        </label>
        <button className="min-h-10 border border-line px-4 font-semibold">Show month</button>
      </form>
      {terms.length > 0 && (
        <nav aria-label="Terms" className="flex flex-wrap gap-2">
          {terms.map((t) => <Link key={t.id} href={`/management/money?term=${t.id}`} className={tab(term?.id === t.id)}>{t.name}</Link>)}
        </nav>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {(['academy', 'club'] as const).map((k) => (
          <section key={k} aria-label={k === 'academy' ? 'Academy Stripe account' : 'Club Stripe account'} className="panel border border-line p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">{k === 'academy' ? 'Rowville Foundation Academy' : 'Rowville Eagles Football Club'} · Stripe</p>
            <p className="mt-2 font-display text-3xl font-semibold">{formatMoney(s.accounts[k].net)}</p>
            <p className="text-sm text-muted">{formatMoney(s.accounts[k].gross)} taken · {formatMoney(s.accounts[k].refunds)} refunded</p>
          </section>
        ))}
      </div>
      <section aria-label="By program" className="panel overflow-x-auto border border-line">
        <table className="w-full min-w-[560px] text-sm">
          <thead><tr className="border-b border-line text-left text-muted"><th className="p-3 font-medium">Program</th><th className="p-3 text-right font-medium">Payments</th><th className="p-3 text-right font-medium">Taken</th><th className="p-3 text-right font-medium">Discounts given</th><th className="p-3 text-right font-medium">Refunds</th><th className="p-3 text-right font-medium">Net</th></tr></thead>
          <tbody className="divide-y divide-line">
            {s.lines.map((l) => <tr key={l.category}><td className="p-3">{CATEGORY_LABEL[l.category]}</td><td className="p-3 text-right">{l.count}</td><td className="p-3 text-right">{formatMoney(l.gross)}</td><td className="p-3 text-right text-muted">{formatMoney(l.discount)}</td><td className="p-3 text-right">{formatMoney(l.refunds)}</td><td className="p-3 text-right font-semibold">{formatMoney(l.net)}</td></tr>)}
            {s.lines.length === 0 && <tr><td colSpan={6} className="p-3 text-muted">No payments in this period.</td></tr>}
          </tbody>
          <tfoot><tr className="border-t border-line font-semibold"><td className="p-3">Total</td><td className="p-3 text-right">{s.total.count}</td><td className="p-3 text-right">{formatMoney(s.total.gross)}</td><td className="p-3 text-right text-muted">{formatMoney(s.total.discount)}</td><td className="p-3 text-right">{formatMoney(s.total.refunds)}</td><td className="p-3 text-right">{formatMoney(s.total.net)}</td></tr></tfoot>
        </table>
      </section>
      <div className="flex flex-wrap gap-2">
        <DownloadCsv list="money" params={term ? { term: term.id } : { m: ym }} label="Download this summary (CSV)" />
      </div>
      <p className="text-xs text-muted">Stripe fees aren’t included (Stripe shows them on each payout). Foundation+ subscriptions are billed by Stripe directly — see Stripe → Billing for those. Sessions paid with credits aren’t counted again (no new card payment).</p>
    </div>
  )
}
