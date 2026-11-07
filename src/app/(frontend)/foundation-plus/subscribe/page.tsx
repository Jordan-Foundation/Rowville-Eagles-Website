import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { foundationSettings, isStaffOrCoach } from '@/academy/pdr/load'
import { familyPlayers } from '@/academy/pdr/billing/subscribe'
import { displayPrices } from '@/academy/pdr/billing/stripe'
import { PLANS, type PlanKey } from '@/academy/pdr/billing/plans'
import { FoundationPlusLogo } from '@/components/FoundationPlusLogo'
import { AddPlayer, SubscribeForm } from './Forms'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Choose a Foundation+ plan', robots: { index: false } }

const aud = (n: number) => n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: n % 1 ? 2 : 0 })
const LIVE = new Set(['active', 'trialing', 'past_due'])

export default async function SubscribePage({ searchParams }: { searchParams: Promise<{ plan?: string; period?: string; player?: string; cancelled?: string }> }) {
  const sp = await searchParams
  const plan = (PLANS.find((p) => p.key === sp.plan) ?? PLANS.find((p) => p.tier === sp.plan && p.interval === (sp.period === 'year' ? 'year' : 'month')) ?? PLANS[2]).key as PlanKey
  const user = await currentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/foundation-plus/subscribe?plan=${plan}`)}`)
  const p = await payload()
  const settings = await foundationSettings(p)
  if (!settings.enabled && !isStaffOrCoach(user)) redirect('/foundation-plus')
  const [kids, prices, s] = await Promise.all([familyPlayers(p, user), displayPrices(p), p.findGlobal({ slug: 'pdr-settings', depth: 0, overrideAccess: true })])
  const live = kids.filter((k) => LIVE.has(k.pdr?.subscriptionStatus ?? ''))
  const pct = s.plans?.siblingDiscountPct ?? 25

  return (
    <div data-page-brand="fplus" className="bg-white text-[#0b0b0c]">
      <div className="fp-ink">
        <div className="container-x py-10">
          <Link href="/foundation-plus" aria-label="Foundation+ home"><FoundationPlusLogo variant="horizontal" tone="white" height={40} /></Link>
          <h1 className="fp-heading mt-6 text-4xl sm:text-5xl">Choose your plan</h1>
        </div>
      </div>
      <div className="container-x max-w-2xl py-12">
        {sp.cancelled && <p className="mb-6 border border-[#0b0b0c]/20 p-4 text-sm">Checkout was cancelled — nothing was charged.</p>}
        {!settings.enabled && <p className="mb-6 border border-amber-500 bg-amber-50 p-4 text-sm">Staff preview — Foundation+ is switched off, so families can’t see this page yet.</p>}
        {kids.length === 0 && <p className="mb-4 text-sm">First, add the player this plan is for:</p>}
        {kids.length > 0 && (
          <SubscribeForm
            initialPlan={plan}
            initialPlayer={Number(sp.player) || undefined}
            players={kids.map((k) => {
              const on = LIVE.has(k.pdr?.subscriptionStatus ?? '')
              return {
                id: k.id,
                name: `${k.firstName} ${k.lastName}`,
                disabled: on,
                note: on ? `Already on ${k.pdr?.tier} — manage from the player page` : 'Free plan',
                discount: !on && live.length > 0 && pct > 0,
              }
            })}
            plans={PLANS.map((pl) => ({ key: pl.key, label: `${pl.tier === 'premium' ? 'Premium' : 'Standard'} · ${pl.interval === 'month' ? 'monthly' : 'yearly'}`, price: `${aud(prices[pl.key])}/${pl.interval}` }))}
          />
        )}
        <div className="mt-8"><AddPlayer /></div>
      </div>
    </div>
  )
}
