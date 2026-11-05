import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { CartView } from './CartView'
import { paymentsMode } from '@/lib/stripe-accounts'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Your cart', robots: { index: false } }

export default async function CartPage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const { cancelled } = await searchParams
  const settings = await (await payload()).findGlobal({ slug: 'site-settings' })
  let ready = false
  try {
    ready = Boolean(paymentsMode('academy'))
  } catch {
    /* not connected yet */
  }
  return (
    <div className="container-x py-14">
      <h1 className="mb-10 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">Your cart</h1>
      {!ready && (
        <p className="mb-8 rounded-2xl border border-line bg-surface-2 p-5 text-sm">
          Online checkout is being set up — you can build your cart now, and payments will open shortly.
        </p>
      )}
      <CartView
        postageFee={settings.shop?.postageFee ?? 0}
        pickupNote={settings.shop?.pickupNote ?? 'Collect from the club'}
        cancelled={Boolean(cancelled)}
      />
    </div>
  )
}
