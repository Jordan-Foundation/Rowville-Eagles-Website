import { randomBytes } from 'node:crypto'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireManagement } from '@/lib/management'
import { payload, formatDate } from '@/lib/payload'
import { formatMoney } from '@/lib/format'
import { stripeAccounts } from '@/lib/stripe-accounts'
import { recentRefunds, searchTransactions, type Txn } from '@/refunds/service'
import { refundAction } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Refunds', robots: { index: false } }

const input = 'mt-1 block w-full min-h-10 border border-line bg-surface px-3 py-2 text-sm'
const KIND: Record<Txn['kind'], string> = { booking: 'Booking', academy: '1-on-1 / small group', order: 'Shop order', invoice: 'Invoice' }

/** Search a player or parent, see everything they've paid for, and refund any of it to the card (admins only). */
export default async function RefundsPage({ searchParams }: { searchParams: Promise<{ q?: string; done?: string; error?: string }> }) {
  const user = await requireManagement('/management/refunds')
  if (!user.roles?.includes('admin')) redirect('/no-access?area=refunds')
  const sp = await searchParams
  const q = (sp.q ?? '').trim().slice(0, 100)
  const p = await payload()
  const [txns, recent] = await Promise.all([q ? searchTransactions(p, q) : Promise.resolve([] as Txn[]), recentRefunds(p)])
  // Group by family
  const families = new Map<string, Txn[]>()
  for (const t of txns) {
    const k = t.account ? `a${t.account}` : `e${t.email.toLowerCase()}`
    families.set(k, [...(families.get(k) ?? []), t])
  }
  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Refunds</h1>
        <p className="mt-2 max-w-3xl text-muted">Search a player or parent to see everything they’ve paid for online, then refund all or part of any payment straight back to the card through Stripe. Every refund is recorded with who made it and why.</p>
      </div>
      <form className="flex flex-wrap items-end gap-3" role="search">
        <label className="block min-w-[16rem] flex-1 text-sm">Player or parent name, email, phone or reference
          <input name="q" defaultValue={q} autoFocus placeholder="e.g. Mia Smith" className={input} />
        </label>
        <button className="min-h-10 bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-black">Search</button>
      </form>
      {(sp.done || sp.error) && <p role={sp.error ? 'alert' : 'status'} className={`border p-4 text-sm ${sp.error ? 'border-red-400/40 text-red-200' : 'border-emerald-400/40 text-emerald-200'}`}>{sp.error ?? sp.done}</p>}

      {q && families.size === 0 && <p className="text-muted">No payments found for “{q}”.</p>}
      {[...families.values()].map((list) => (
        <section key={`${list[0].account ?? list[0].email}`} aria-label={`${list[0].family || list[0].email} payments`} className="panel border border-line">
          <h2 className="border-b border-line px-5 py-3 font-display text-lg font-semibold uppercase">{list[0].family || 'Family'} <span className="text-sm font-normal normal-case text-muted">{list[0].email}</span></h2>
          <ul className="divide-y divide-line">
            {list.map((t) => (
              <li key={`${t.kind}${t.id}`} className="px-5 py-4" data-txn={t.reference}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{t.description}</p>
                    <p className="text-sm text-muted">{[t.player, KIND[t.kind], formatDate(t.at), t.reference, stripeAccounts[t.payee].label, t.status].filter(Boolean).join(' · ')}</p>
                  </div>
                  <p className="text-right text-sm">
                    <span className="block font-semibold">{formatMoney(t.paid)} paid</span>
                    {t.refunded > 0 && <span className="block text-amber-300">{formatMoney(t.refunded)} refunded</span>}
                  </p>
                </div>
                {t.refundable > 0 ? (
                  <details className="mt-3">
                    <summary className="inline-flex min-h-10 cursor-pointer items-center border border-line px-4 text-xs font-semibold uppercase tracking-[0.12em]">Refund</summary>
                    <form action={refundAction} className="mt-3 grid gap-3 border border-line p-4 sm:grid-cols-[10rem_1fr]">
                      <input type="hidden" name="kind" value={t.kind} />
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="q" value={q} />
                      <input type="hidden" name="nonce" value={randomBytes(12).toString('hex')} />
                      <label className="block text-sm">Amount ($)<input name="amount" type="number" step="0.01" min="0.01" max={t.refundable} defaultValue={t.refundable} required className={input} /><span className="mt-1 block text-xs text-muted">Up to {formatMoney(t.refundable)}</span></label>
                      <label className="block text-sm">Reason (kept with the refund)<input name="reason" required placeholder="e.g. Injured — couldn’t attend the camp" className={input} /></label>
                      <div className="flex flex-wrap gap-4 text-sm sm:col-span-2">
                        {t.cancellable && <label className="flex items-center gap-2"><input type="checkbox" name="cancel" defaultChecked /> Also cancel the booking (frees the place)</label>}
                        <label className="flex items-center gap-2"><input type="checkbox" name="emailFamily" defaultChecked={!!t.email} /> Email the family</label>
                      </div>
                      <div className="sm:col-span-2">
                        <button className="min-h-10 bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-black">Refund to card</button>
                        <span className="ml-3 text-xs text-muted">Goes back to the card they paid with, from the {stripeAccounts[t.payee].label} Stripe account. This can’t be undone.</span>
                      </div>
                    </form>
                  </details>
                ) : (
                  <p className="mt-2 text-sm text-muted">{t.note ?? (t.refunded > 0 ? 'Fully refunded.' : 'Nothing to refund.')}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section aria-label="Recent refunds" className="panel overflow-x-auto border border-line">
        <h2 className="border-b border-line px-5 py-3 font-display text-lg font-semibold uppercase">Recent refunds</h2>
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="border-b border-line text-left text-muted"><th className="p-3 font-normal">When</th><th className="p-3 font-normal">For</th><th className="p-3 font-normal">Reason</th><th className="p-3 font-normal">By</th><th className="p-3 text-right font-normal">Amount</th></tr></thead>
          <tbody className="divide-y divide-line">
            {recent.map((r) => (
              <tr key={r.id}>
                <td className="p-3 whitespace-nowrap">{formatDate(r.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                <td className="p-3">{r.description}{r.playerName ? ` · ${r.playerName}` : ''} <span className="text-muted">· {r.reference}{r.cancelled ? ' · cancelled' : ''}</span></td>
                <td className="p-3 text-muted">{r.reason}{r.status === 'failed' ? <span className="block text-red-300">Failed: {r.error}</span> : null}</td>
                <td className="p-3">{typeof r.by === 'object' && r.by ? r.by.firstName || r.by.email : ''}</td>
                <td className="p-3 text-right font-semibold">{r.status === 'failed' ? '—' : formatMoney(r.amount)}{r.status === 'simulated' ? <span className="block text-xs font-normal text-muted">test</span> : null}</td>
              </tr>
            ))}
            {recent.length === 0 && <tr><td colSpan={5} className="p-3 text-muted">No refunds yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  )
}
