import Link from 'next/link'
import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { payload } from '@/lib/payload'
import { localYmd } from '@/lib/time'
import { invoiceFormData } from '@/invoices/form-data'
import { InvoiceForm } from '../InvoiceForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'New invoice', robots: { index: false } }

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  await requireManagement('/management/invoices/new')
  const sp = await searchParams
  const p = await payload()
  const { catalogue, families } = await invoiceFormData(p)
  const fam = families.find((f) => String(f.id) === sp.account)
  const due = localYmd(new Date(Date.now() + 7 * 86_400_000))
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href="/management/invoices" className="text-sm text-muted hover:text-ink">← Invoices</Link>
        <h1 className="mt-2 font-display text-3xl font-semibold uppercase tracking-tight">New invoice</h1>
      </div>
      <InvoiceForm catalogue={catalogue} families={families} initial={{ payee: 'academy', account: fam?.id ?? null, contactName: fam?.name, contactEmail: fam?.email, contactPhone: fam?.phone, lines: [], dueDate: due }} />
    </div>
  )
}
