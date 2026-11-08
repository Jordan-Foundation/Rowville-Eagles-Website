import type { Metadata } from 'next'
import Link from 'next/link'
import { requireManagement } from '@/lib/management'
import { payload } from '@/lib/payload'
import { loadPrices } from '@/components/admin/prices-data'
import { PricesEditor } from './PricesEditor'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Set prices', robots: { index: false } }

export default async function SetPricesPage() {
  await requireManagement('/management/prices')
  const sections = await loadPrices(await payload())
  return (
    <div className="container-x max-w-5xl py-14">
      <Link href="/management" className="text-sm text-muted hover:text-ink">← Management</Link>
      <h1 className="mt-4 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">Set prices</h1>
      <p className="mt-4 text-muted">
        Every price families pay, in one place. Change any amount and press <strong>Save all changes</strong>. New prices apply to new bookings only — anything already paid or in a
        family’s checkout keeps its price. All amounts are AUD incl. GST.
      </p>
      <PricesEditor sections={sections} />
    </div>
  )
}
