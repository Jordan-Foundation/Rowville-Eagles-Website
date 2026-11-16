import { groupLabel } from '@/lib/age-groups'
import { trialNightsOf } from '@/lib/trials'
import { TrackConversion } from '@/tracking/TrackConversion'
import { conversionFor } from '@/tracking/config'
import Link from 'next/link'
import type { Metadata } from 'next'
import { payload, formatDate } from '@/lib/payload'
import { RfaPromo } from '@/components/RfaPromo'
import type { TrialSession } from '@/payload-types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Thanks for registering', robots: { index: false } }

export default async function ThanksPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams
  const p = await payload()
  const reg = ref
    ? (await p.find({ pagination: false, collection: 'selection-entries', where: { reference: { equals: ref } }, limit: 1, depth: 1, overrideAccess: true })).docs[0]
    : undefined
  const nights = reg ? trialNightsOf(reg) : []
  const booked = reg?.status === 'trial-booked' && nights.length > 0

  return (
    <div className="container-x max-w-3xl py-16">
      {reg?.reference && <TrackConversion c={conversionFor({ category: 'club-trial', amount: 0, ref: reg.reference, lead: true })} />}
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent text-2xl text-accent-ink">✓</div>
        <h1 className="mt-6 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">{booked ? 'Trial booked!' : 'You’re on the list!'}</h1>
        {reg && (
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
            {booked
              ? `${reg.player.firstName} is booked in for ${nights.map((n) => formatDate(n.start, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })).join(' and ')}. We’ve emailed you the details.`
              : `We’ve registered ${reg.player.firstName}’s interest for the ${reg.birthYear ? groupLabel(reg.birthYear) : 'their age group'}. We’ll email ${reg.contact.email} as soon as trial dates are set.`}
          </p>
        )}
        {reg && <p className="mt-2 text-sm text-muted">Reference <span className="font-mono font-semibold text-ink">{reg.reference}</span></p>}
      </div>
      <div className="mt-12">
        <RfaPromo />
      </div>
      <p className="mt-10 text-center">
        <Link href="/" className="font-semibold underline">Back to home</Link>
      </p>
    </div>
  )
}
