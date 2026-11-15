import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireManagement } from '@/lib/management'
import { payload, formatDate } from '@/lib/payload'
import { formatMoney } from '@/lib/format'
import { localYmd } from '@/lib/time'
import { stripeAccounts } from '@/lib/stripe-accounts'
import { INVOICE_STATUS, isOverdue, lineTotal } from '@/invoices/totals'
import { invoiceLink } from '@/invoices/service'
import { draftFrom, invoiceFormData } from '@/invoices/form-data'
import { InvoiceForm } from '../InvoiceForm'
import { invoiceAction } from '../actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Invoice', robots: { index: false } }

const btn = 'min-h-10 border border-line px-4 text-xs font-semibold uppercase tracking-[0.12em]'
const when = (iso?: string | null) => (iso ? formatDate(iso, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')

/** One invoice: what's on it, the pay link, send / remind / mark paid / cancel — and edit while unpaid. */
export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string; error?: string; edit?: string }> }) {
  const { id } = await params
  await requireManagement(`/management/invoices/${id}`)
  const sp = await searchParams
  const p = await payload()
  const inv = await p.findByID({ collection: 'invoices', id: Number(id), depth: 0, overrideAccess: true, showHiddenFields: true, disableErrors: true })
  if (!inv) notFound()
  const unpaid = inv.status === 'draft' || inv.status === 'sent'
  const late = isOverdue(inv, localYmd(new Date()), localYmd)
  const accountId = inv.account ? (typeof inv.account === 'object' ? inv.account.id : inv.account) : null
  const form = unpaid && (sp.edit === '1' || inv.status === 'draft') ? await invoiceFormData(p) : null
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href="/management/invoices" className="text-sm text-muted hover:text-ink">← Invoices</Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold uppercase tracking-tight">Invoice {inv.reference}</h1>
            <p className="mt-1 text-sm text-muted">{inv.contactName}{inv.playerName ? ` · for ${inv.playerName}` : ''} · paid to {stripeAccounts[inv.payee === 'club' ? 'club' : 'academy'].label}</p>
          </div>
          <p className="text-right">
            <span className="block font-display text-3xl font-semibold">{formatMoney(inv.total ?? 0)}</span>
            <span className={`text-sm ${late ? 'font-semibold text-amber-300' : 'text-muted'}`} data-status>{late ? 'Overdue' : INVOICE_STATUS[inv.status]}</span>
          </p>
        </div>
      </div>
      {(sp.done || sp.error) && <p role={sp.error ? 'alert' : 'status'} className={`border p-4 text-sm ${sp.error ? 'border-red-400/40 text-red-200' : 'border-emerald-400/40 text-emerald-200'}`}>{sp.error ?? sp.done}</p>}

      {form ? (
        <InvoiceForm catalogue={form.catalogue} families={form.families} initial={draftFrom(inv)} />
      ) : (
        <section aria-label="Items" className="panel border border-line">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-muted"><th className="p-3 font-normal">Item</th><th className="p-3 text-right font-normal">Qty</th><th className="p-3 text-right font-normal">Each</th><th className="p-3 text-right font-normal">Total</th></tr></thead>
            <tbody>
              {(inv.items ?? []).map((l, i) => <tr key={i} className="border-b border-line"><td className="p-3">{l.description}</td><td className="p-3 text-right">{l.quantity}</td><td className="p-3 text-right">{formatMoney(l.unitPrice)}</td><td className="p-3 text-right">{formatMoney(lineTotal(l))}</td></tr>)}
              <tr><td colSpan={3} className="p-3 text-right font-semibold">Total</td><td className="p-3 text-right font-semibold">{formatMoney(inv.total ?? 0)}</td></tr>
            </tbody>
          </table>
          {inv.note && <p className="border-t border-line p-3 text-sm text-muted">Note: {inv.note}</p>}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="Details" className="panel border border-line p-5 text-sm">
          <dl className="space-y-2">
            <div className="flex justify-between gap-3"><dt className="text-muted">Email</dt><dd>{inv.contactEmail || '—'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Mobile</dt><dd>{inv.contactPhone || '—'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Family account</dt><dd>{accountId ? <Link href={`/management/families/${accountId}`} className="underline">Open family</Link> : 'Not linked'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Due</dt><dd>{inv.dueDate ? formatDate(inv.dueDate) : 'No due date'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Created</dt><dd>{when(inv.createdAt)}</dd></div>
            {inv.sentAt && <div className="flex justify-between gap-3"><dt className="text-muted">Sent</dt><dd>{when(inv.sentAt)}</dd></div>}
            {inv.remindedAt && <div className="flex justify-between gap-3"><dt className="text-muted">Reminder sent</dt><dd>{when(inv.remindedAt)}</dd></div>}
            {inv.paidAt && <div className="flex justify-between gap-3"><dt className="text-muted">Paid</dt><dd>{when(inv.paidAt)} · {inv.paidVia === 'manual' ? inv.paymentNote || 'marked paid' : 'card'}</dd></div>}
          </dl>
          {inv.status !== 'draft' && (
            <label className="mt-4 block text-xs text-muted">Pay link (private to this family)
              <input readOnly value={invoiceLink(inv)} className="mt-1 block w-full border border-line bg-surface px-3 py-2 text-xs text-ink" data-pay-link />
            </label>
          )}
        </section>

        {unpaid && (
          <section aria-label="Actions" className="panel space-y-5 border border-line p-5 text-sm">
            <form action={invoiceAction} className="space-y-3">
              <input type="hidden" name="id" value={inv.id} />
              <p className="font-semibold">{inv.status === 'draft' ? 'Send the invoice' : 'Send again or remind'}</p>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2"><input type="checkbox" name="byEmail" aria-label="Send by email" defaultChecked={!!inv.contactEmail} /> Email</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="bySms" aria-label="Send by text" defaultChecked={!!inv.contactPhone} /> Text</label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button name="do" value="send" className="min-h-10 bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-black">{inv.status === 'draft' ? 'Send' : 'Send again'}</button>
                {inv.status === 'sent' && <button name="do" value="remind" className={btn}>Send a reminder</button>}
              </div>
            </form>
            <form action={invoiceAction} className="space-y-2 border-t border-line pt-4">
              <input type="hidden" name="id" value={inv.id} />
              <label className="block">Paid another way? <span className="text-muted">(cash, bank transfer)</span>
                <input name="paymentNote" placeholder="e.g. Cash at training 12 Nov" className="mt-1 block w-full min-h-10 border border-line bg-surface px-3 py-2" />
              </label>
              <button name="do" value="paid" className={btn}>Mark as paid</button>
            </form>
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              {inv.status === 'sent' && sp.edit !== '1' && <Link href={`/management/invoices/${inv.id}?edit=1`} className={`${btn} inline-flex items-center`}>Edit</Link>}
              <form action={invoiceAction}><input type="hidden" name="id" value={inv.id} /><button name="do" value="cancel" className={`${btn} text-muted`}>Cancel invoice</button></form>
            </div>
          </section>
        )}

        {inv.status === 'paid' && (
          <section aria-label="Actions" className="panel space-y-3 border border-line p-5 text-sm">
            <p>{inv.paidVia === 'card' ? 'Paid online by card. To give the money back, refund it in Stripe, then record it here.' : 'Marked as paid by Management.'}</p>
            <form action={invoiceAction}><input type="hidden" name="id" value={inv.id} /><button name="do" value="refunded" className={btn}>Mark as refunded</button></form>
          </section>
        )}
      </div>
    </div>
  )
}
