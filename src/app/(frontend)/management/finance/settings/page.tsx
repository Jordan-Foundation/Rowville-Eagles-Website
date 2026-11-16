import Link from 'next/link'
import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { formatMoney } from '@/lib/format'
import { requireFinance } from '@/finance/access'
import { financeSettings } from '@/finance/settings'
import { categories } from '@/finance/expenses'
import { gmailConfigured, redirectUri } from '@/finance/gmail'
import { COACHED_KINDS, KIND_LABEL } from '@/finance/rules'
import { gmailAction, saveCategories, saveFinanceSettings } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Finance · Settings', robots: { index: false } }

const btn = 'min-h-9 border border-line px-3 text-xs font-semibold uppercase tracking-[0.1em]'
const input = 'min-h-9 border border-line bg-surface px-2 text-sm'
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—')

export default async function FinanceSettingsPage({ searchParams }: { searchParams: Promise<{ done?: string; error?: string }> }) {
  await requireFinance('/management/finance/settings')
  const sp = await searchParams
  const p = await payload()
  const [s, cats, { docs: recurring }] = await Promise.all([financeSettings(p), categories(p), p.find({ collection: 'expenses', where: { recurring: { equals: true } }, sort: '-date', limit: 100, depth: 0, overrideAccess: true })])
  const recurringBySupplier = [...new Map(recurring.map((e) => [e.supplier.toLowerCase(), e])).values()]
  return (
    <div className="max-w-4xl space-y-8 text-sm">
      {sp.done && <p role="status" className="border border-emerald-500/50 bg-emerald-500/10 px-4 py-3">{sp.done}</p>}
      {sp.error && <p role="alert" className="border border-red-500/50 bg-red-500/10 px-4 py-3">{sp.error}</p>}

      <form action={saveFinanceSettings} className="panel space-y-6 border border-line p-5">
        <fieldset className="space-y-3"><legend className="font-semibold">Pay</legend>
          <div className="flex flex-wrap gap-4">
            <label className="grid gap-1">Super guarantee rate (%)<input type="number" step="0.01" name="superRate" defaultValue={s.superRate} className={`${input} w-28`} /></label>
            <label className="grid gap-1">Share-link bonus (% of what the customer paid per session)<input type="number" step="0.1" name="bonusPct" defaultValue={s.bonusPct} className={`${input} w-28`} /></label>
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" name="superOnBonus" defaultChecked={s.superOnBonus} /> Pay super on share-link bonuses too (check with your accountant)</label>
          <p className="text-muted">Hourly rates are set per coach in <Link className="underline" href="/management/finance/coaches">Coach hours & pay</Link>. Super is paid on top of wages, shown per pay week (Payday Super from 1 July 2026).</p>
        </fieldset>
        <fieldset className="space-y-3"><legend className="font-semibold">Setup & pack-up</legend>
          <div className="flex flex-wrap gap-4">
            <label className="grid gap-1">Minutes before each block<input type="number" name="setupMinutes" defaultValue={s.setupMinutes} className={`${input} w-24`} /></label>
            <label className="grid gap-1">Minutes after each block<input type="number" name="packupMinutes" defaultValue={s.packupMinutes} className={`${input} w-24`} /></label>
            <label className="grid gap-1">Gap allowed between back-to-back sessions (min)<input type="number" name="blockGapMinutes" defaultValue={s.blockGapMinutes} className={`${input} w-24`} /></label>
          </div>
          <div className="flex flex-wrap gap-3">{COACHED_KINDS.map((k) => <label key={k} className="flex items-center gap-1"><input type="checkbox" name="setupKinds" value={k} defaultChecked={s.setupKinds.includes(k)} /> {KIND_LABEL[k]}</label>)}</div>
        </fieldset>
        <fieldset className="space-y-3"><legend className="font-semibold">Rowville Eagles (coaches marked “Eagles” only)</legend>
          <div className="flex flex-wrap gap-4">
            <label className="grid gap-1">Training season from<input type="date" name="eaglesSeasonStart" defaultValue={s.eaglesSeasonStart ?? ''} className={input} /></label>
            <label className="grid gap-1">to<input type="date" name="eaglesSeasonEnd" defaultValue={s.eaglesSeasonEnd ?? ''} className={input} /></label>
            <label className="grid gap-1">Game length (minutes)<input type="number" name="eaglesGameMinutes" defaultValue={s.eaglesGameMinutes} className={`${input} w-24`} /></label>
          </div>
          <p className="text-muted">Team training counts each week between these dates; games count from the team’s fixtures.</p>
        </fieldset>
        <fieldset className="space-y-3"><legend className="font-semibold">Weekly report</legend>
          <label className="grid gap-1">Send to (emails, comma-separated — empty = all admins)<input name="reportRecipients" defaultValue={s.reportRecipients.join(', ')} className={input} /></label>
          <div className="flex flex-wrap gap-4">
            <label className="grid gap-1">Day<select name="reportDay" defaultValue={s.reportDay} className={input}><option value="1">Monday</option><option value="2">Tuesday</option><option value="0">Sunday</option></select></label>
            <label className="grid gap-1">Hour (Melbourne, 0–23)<input type="number" name="reportHour" defaultValue={s.reportHour} className={`${input} w-24`} /></label>
          </div>
        </fieldset>
        <button className={btn}>Save settings</button>
      </form>

      <section className="panel space-y-3 border border-line p-5" aria-label="Email receipts">
        <h2 className="font-semibold">Receipts from email (Gmail, read-only)</h2>
        {s.gmail.email ? (
          <>
            <p>Connected to <strong>{s.gmail.email}</strong> since {when(s.gmail.connectedAt)} · last checked {when(s.gmail.lastCheckedAt)}{s.gmail.lastError ? <span className="text-red-400"> · {s.gmail.lastError}</span> : ''}</p>
            <form action={gmailAction} className="flex gap-2"><button name="do" value="check" className={btn}>Check now</button><button name="do" value="disconnect" className={btn}>Disconnect</button></form>
          </>
        ) : gmailConfigured() ? (
          <a className={btn} href="/management/finance/gmail/connect">Connect the Gmail inbox</a>
        ) : (
          <div className="space-y-2 text-muted">
            <p>One-off setup (about 10 minutes), signed in to Google as the Workspace admin:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Go to console.cloud.google.com → create a project (e.g. “Rowville website”).</li>
              <li>APIs & Services → Library → enable <strong>Gmail API</strong>.</li>
              <li>OAuth consent screen → User type <strong>Internal</strong> (so Google’s app review isn’t needed) → add the scope <code>gmail.readonly</code>.</li>
              <li>Credentials → Create credentials → OAuth client ID → <em>Web application</em> → Authorised redirect URI: <code>{redirectUri()}</code></li>
              <li>In Vercel → Settings → Environment Variables add <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code>, then redeploy and come back here to connect.</li>
            </ol>
          </div>
        )}
        <p className="text-xs text-muted">Every 3 hours the site searches the last 10 days for likely receipts and invoices, sends just that email and its attachment to Claude to read, and adds it under Expenses as “needs review”. Nothing else from the mailbox is read or stored.</p>
      </section>

      <form action={saveCategories} className="panel space-y-3 border border-line p-5" aria-label="Expense categories">
        <h2 className="font-semibold">Expense categories</h2>
        {cats.map((c) => <div key={c.id} className="flex items-center gap-2"><input name={`cat-${c.id}`} defaultValue={c.name} className={input} aria-label="Category name" /><label className="flex items-center gap-1"><input type="checkbox" name={`active-${c.id}`} defaultChecked={c.active !== false} /> In use</label></div>)}
        <label className="grid max-w-xs gap-1">Add a category<input name="newCategory" className={input} /></label>
        <button className={btn}>Save categories</button>
      </form>

      <section className="panel space-y-2 border border-line p-5" aria-label="Recurring expenses">
        <h2 className="font-semibold">Recurring expenses</h2>
        <p className="text-muted">Expenses ticked “Recurring every month” (used in Projections). Tick or untick on an expense to change this list.</p>
        <ul className="divide-y divide-line">{recurringBySupplier.map((e) => <li key={e.id} className="flex justify-between gap-2 py-2"><span>{e.supplier}</span><span>{formatMoney(e.amount)}/month</span></li>)}{!recurringBySupplier.length && <li className="py-2 text-muted">None yet.</li>}</ul>
      </section>

      <section className="panel space-y-2 border border-line p-5" aria-label="Bank">
        <h2 className="font-semibold">Bank (Westpac)</h2>
        <p className="text-muted">For now, upload statements in <Link className="underline" href="/management/finance/expenses?tab=bank">Expenses → Bank import</Link> (CSV or OFX). Because the club uses Xero, its Westpac bank feed can be connected here next so transactions arrive automatically — that needs a Xero app connection (ask when you’re ready).</p>
      </section>
    </div>
  )
}
