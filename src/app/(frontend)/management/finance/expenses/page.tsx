import Link from 'next/link'
import type { Metadata } from 'next'
import type { Where } from 'payload'
import { payload } from '@/lib/payload'
import { localYmd } from '@/lib/time'
import { formatMoney } from '@/lib/format'
import { requireFinance } from '@/finance/access'
import { categories } from '@/finance/expenses'
import { ReceiptForm } from './ReceiptForm'
import { importStatementAction, rematchAction, resolveBankAction, updateExpenseAction } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Finance · Expenses', robots: { index: false } }

type SP = { tab?: string; status?: string; cat?: string; from?: string; to?: string; bank?: string; done?: string; error?: string }
const btn = 'min-h-9 border border-line px-3 text-xs font-semibold uppercase tracking-[0.1em]'
const input = 'min-h-9 border border-line bg-surface px-2 text-sm'
const day = (ymd: string) => new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${ymd}T00:00:00Z`))
const SOURCE: Record<string, string> = { email: '✉️ email', photo: '📷 photo', bank: '🏦 bank', manual: '✍️ manual' }

/** Expenses (manual, receipt photos, email import), Westpac statement import, and bank debits still missing a receipt. */
export default async function ExpensesPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireFinance('/management/finance/expenses')
  const sp = await searchParams
  const p = await payload()
  const tab = (['list', 'add', 'missing', 'bank'] as const).find((t) => t === sp.tab) ?? 'list'
  const cats = (await categories(p)).filter((c) => c.active !== false)
  const today = localYmd(new Date())
  const [{ totalDocs: missingCount }, { totalDocs: reviewCount }] = await Promise.all([
    p.count({ collection: 'bank-transactions', where: { and: [{ status: { equals: 'unmatched' } }, { direction: { equals: 'debit' } }] }, overrideAccess: true }),
    p.count({ collection: 'expenses', where: { status: { equals: 'needs_review' } }, overrideAccess: true }),
  ])
  const tabCls = (on: boolean) => `min-h-10 border px-3 py-2 text-sm ${on ? 'border-white bg-white text-black' : 'border-line text-muted hover:text-ink'}`

  let body: React.ReactNode
  if (tab === 'add') {
    const bank = sp.bank ? await p.findByID({ collection: 'bank-transactions', id: Number(sp.bank), depth: 0, overrideAccess: true, disableErrors: true }) : null
    body = (
      <div className="max-w-2xl space-y-3">
        {bank && <p className="text-sm">For bank debit: <strong>{day(bank.date)} · {bank.description} · {formatMoney(bank.amount)}</strong></p>}
        <ReceiptForm categories={cats.map((c) => ({ id: c.id, name: c.name }))} today={today} bank={bank ? { id: bank.id, date: bank.date, amount: bank.amount, description: bank.description ?? '' } : undefined} />
      </div>
    )
  } else if (tab === 'missing') {
    const [{ docs: debits }, { docs: unlinked }, { docs: resolved }] = await Promise.all([
      p.find({ collection: 'bank-transactions', where: { and: [{ status: { equals: 'unmatched' } }, { direction: { equals: 'debit' } }] }, sort: '-date', limit: 200, depth: 0, overrideAccess: true }),
      p.find({ collection: 'expenses', where: { bankTransaction: { exists: false } }, sort: '-date', limit: 300, depth: 0, overrideAccess: true }),
      p.find({ collection: 'bank-transactions', where: { status: { in: ['ignored', 'income_transfer', 'matched'] } }, sort: '-date', limit: 30, depth: 1, overrideAccess: true }),
    ])
    body = (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">Money that left the bank account with no expense recorded. Add the receipt, link it to an expense, or mark it as not an expense (transfers, coach pay, refunds).</p>
          <form action={rematchAction}><button className={btn}>Re-run matching</button></form>
        </div>
        <ul className="space-y-3" aria-label="Missing receipts">
          {debits.map((d) => {
            const near = unlinked.filter((e) => Math.abs(e.amount - d.amount) < 0.005 || Math.abs(Date.parse(e.date) - Date.parse(d.date)) <= 7 * 86_400_000).slice(0, 15)
            return (
              <li key={d.id} className="panel border border-line p-4 text-sm" data-missing={d.id}>
                <p className="flex flex-wrap justify-between gap-2"><strong>{d.description}</strong><span className="tabular-nums">{day(d.date)} · {formatMoney(d.amount)}</span></p>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <Link className={btn} href={`/management/finance/expenses?tab=add&bank=${d.id}`}>Add receipt / expense</Link>
                  {near.length > 0 && (
                    <form action={resolveBankAction} className="flex flex-wrap gap-2"><input type="hidden" name="id" value={d.id} /><input type="hidden" name="do" value="link" />
                      <select name="expense" className={input} aria-label="Expense to link"><option value="">Link to an expense…</option>{near.map((e) => <option key={e.id} value={e.id}>{day(e.date)} · {e.supplier} · {formatMoney(e.amount)}</option>)}</select>
                      <button className={btn}>Link</button>
                    </form>
                  )}
                  <form action={resolveBankAction} className="flex flex-wrap gap-2"><input type="hidden" name="id" value={d.id} />
                    <input name="note" placeholder="e.g. Coach pay, transfer" className={`${input} w-44`} aria-label="Note" />
                    <button name="do" value="ignore" className={btn}>Not an expense</button>
                  </form>
                </div>
              </li>
            )
          })}
          {!debits.length && <li className="text-sm text-muted">Nothing missing. Import a statement to check.</li>}
        </ul>
        {resolved.length > 0 && (
          <details className="panel border border-line p-4 text-sm"><summary className="cursor-pointer font-semibold">Recently sorted</summary>
            <ul className="mt-2 divide-y divide-line">{resolved.map((d) => <li key={d.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{day(d.date)} · {d.description} · {formatMoney(d.amount)} <span className="text-muted">— {d.status === 'matched' ? `matched to ${typeof d.matchedExpense === 'object' && d.matchedExpense ? d.matchedExpense.supplier : 'an expense'}` : d.status === 'income_transfer' ? 'income transfer' : `not an expense${d.note ? ` (${d.note})` : ''}`}</span></span><form action={resolveBankAction}><input type="hidden" name="id" value={d.id} /><button name="do" value="unmatch" className="text-xs underline">Undo</button></form></li>)}</ul>
          </details>
        )}
      </div>
    )
  } else if (tab === 'bank') {
    const { docs: recent } = await p.find({ collection: 'bank-transactions', sort: '-date', limit: 40, depth: 0, overrideAccess: true })
    body = (
      <div className="space-y-6">
        <form action={importStatementAction} className="panel max-w-2xl space-y-3 border border-line p-5 text-sm" aria-label="Import statement">
          <h2 className="font-semibold">Import a Westpac statement</h2>
          <ol className="list-decimal space-y-1 pl-5 text-muted">
            <li>In Westpac Live, open the business account → <em>Export transactions</em>.</li>
            <li>Choose <strong>CSV</strong> (or OFX/“Quicken”), pick the dates, and download.</li>
            <li>Upload it here. Transactions already imported are skipped, so overlapping dates are fine.</li>
          </ol>
          <input type="file" name="file" accept=".csv,.ofx,.qfx,text/csv" required className="block" />
          <button className={btn}>Import</button>
          <p className="text-xs text-muted">Stripe payouts are recognised as income transfers automatically. Xero’s Westpac bank feed (or Open Banking) can replace this upload later without changing anything else.</p>
        </form>
        <section className="panel border border-line p-4 text-sm"><h2 className="font-semibold">Latest transactions</h2>
          <ul className="mt-2 divide-y divide-line">{recent.map((t) => <li key={t.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{day(t.date)} · {t.description}</span><span className="tabular-nums">{t.direction === 'debit' ? '−' : '+'}{formatMoney(t.amount)} <span className="text-muted">· {({ unmatched: 'no receipt', matched: 'matched', ignored: 'not an expense', income_transfer: 'income' } as Record<string, string>)[t.status]}</span></span></li>)}{!recent.length && <li className="py-2 text-muted">None yet.</li>}</ul>
        </section>
      </div>
    )
  } else {
    const where: Where = { and: [
      ...(sp.status === 'needs_review' || sp.status === 'approved' ? [{ status: { equals: sp.status } }] : []),
      ...(Number(sp.cat) ? [{ category: { equals: Number(sp.cat) } }] : []),
      ...(sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? [{ date: { greater_than_equal: sp.from } }] : []),
      ...(sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? [{ date: { less_than_equal: sp.to } }] : []),
    ] }
    const { docs } = await p.find({ collection: 'expenses', where, sort: '-date', limit: 300, depth: 1, overrideAccess: true })
    const total = docs.reduce((n, e) => n + e.amount, 0)
    body = (
      <div className="space-y-4">
        <form className="flex flex-wrap items-end gap-3 text-sm" aria-label="Filters">
          <input type="hidden" name="tab" value="list" />
          <label className="grid gap-1">Status<select name="status" defaultValue={sp.status ?? ''} className={input}><option value="">All</option><option value="needs_review">Needs review</option><option value="approved">Approved</option></select></label>
          <label className="grid gap-1">Category<select name="cat" defaultValue={sp.cat ?? ''} className={input}><option value="">All</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="grid gap-1">From<input type="date" name="from" defaultValue={sp.from ?? ''} className={input} /></label>
          <label className="grid gap-1">To<input type="date" name="to" defaultValue={sp.to ?? ''} className={input} /></label>
          <button className={btn}>Filter</button>
          <span className="ml-auto text-muted">{docs.length} expense{docs.length === 1 ? '' : 's'} · {formatMoney(total)}</span>
        </form>
        <ul className="panel divide-y divide-line border border-line" aria-label="Expenses">
          {docs.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm" data-expense={e.supplier}>
              <span>
                <strong>{e.supplier}</strong> <span className="text-muted">· {day(e.date)} · {typeof e.category === 'object' && e.category ? e.category.name : 'No category'} · {SOURCE[e.source]}{e.recurring ? ' · monthly' : ''}</span>
                {e.description && <span className="block text-xs text-muted">{e.description}</span>}
                <span className="block text-xs text-muted">{e.receipt && typeof e.receipt === 'object' ? <a className="underline" href={e.receipt.url ?? '#'} target="_blank" rel="noreferrer">Receipt</a> : 'No receipt file'}{e.bankTransaction ? ' · matched to bank' : ''}</span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold tabular-nums">{formatMoney(e.amount)}</span>{e.gst ? <span className="text-xs text-muted">GST {formatMoney(e.gst)}</span> : null}
                {e.status === 'needs_review' && (
                  <form action={updateExpenseAction} className="flex gap-2"><input type="hidden" name="id" value={e.id} /><input type="hidden" name="tab" value="list" />
                    <select name="category" defaultValue={typeof e.category === 'object' && e.category ? e.category.id : ''} className={input} aria-label="Category"><option value="">Category…</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    <button name="do" value="approve" className={btn}>Approve</button>
                  </form>
                )}
                <form action={updateExpenseAction}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="tab" value="list" /><button name="do" value="delete" className="text-xs underline">Delete</button></form>
              </span>
            </li>
          ))}
          {!docs.length && <li className="p-4 text-sm text-muted">No expenses yet. Add a receipt, connect the email inbox (Settings), or import a bank statement.</li>}
        </ul>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {sp.done && <p role="status" className="border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm">{sp.done}</p>}
      {sp.error && <p role="alert" className="border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm">{sp.error}</p>}
      <nav className="flex flex-wrap gap-2" aria-label="Expenses">
        <Link className={tabCls(tab === 'list')} href="/management/finance/expenses">Expenses{reviewCount ? ` (${reviewCount} to review)` : ''}</Link>
        <Link className={tabCls(tab === 'add')} href="/management/finance/expenses?tab=add">+ Add receipt</Link>
        <Link className={tabCls(tab === 'missing')} href="/management/finance/expenses?tab=missing">Missing receipts{missingCount ? ` (${missingCount})` : ''}</Link>
        <Link className={tabCls(tab === 'bank')} href="/management/finance/expenses?tab=bank">Bank import</Link>
      </nav>
      {body}
    </div>
  )
}
