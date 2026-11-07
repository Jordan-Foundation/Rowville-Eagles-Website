import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { confirmCheckout, ownsPlayer } from '@/academy/pdr/billing/subscribe'
import { FoundationPlusLogo } from '@/components/FoundationPlusLogo'
import type { Participant } from '@/payload-types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Welcome to Foundation+', robots: { index: false } }

export default async function SubscribeDone({ searchParams }: { searchParams: Promise<{ player?: string; session_id?: string }> }) {
  const sp = await searchParams
  const user = await currentUser()
  if (!user) redirect('/login?next=/account')
  const p = await payload()
  if (sp.session_id) await confirmCheckout(p, sp.session_id).catch((e) => p.logger.error({ err: e, msg: 'Confirming Foundation+ checkout failed (the webhook will retry)' }))
  const kid = (await p.findByID({ collection: 'participants', id: Number(sp.player), depth: 0, overrideAccess: true, disableErrors: true })) as Participant | null
  if (!ownsPlayer(kid, user)) redirect('/account')
  const ready = kid!.pdr?.tier && kid!.pdr.tier !== 'free'
  return (
    <div data-page-brand="fplus" className="fp-ink">
      <div className="container-x max-w-2xl py-20 text-center">
        <FoundationPlusLogo variant="mark" tone="white" height={64} className="mx-auto" alt="Foundation+" />
        <h1 className="fp-heading mt-8 text-4xl sm:text-6xl">{ready ? 'You’re in!' : 'Almost there…'}</h1>
        <p className="mt-4 text-lg text-white/75">
          {ready
            ? `${kid!.firstName} is on Foundation+ ${kid!.pdr!.tier === 'premium' ? 'Premium' : 'Standard'}${kid!.pdr!.subscriptionStatus === 'trialing' ? ' — free month started' : ''}. We’ve emailed you the details.`
            : 'We’re confirming your payment with Stripe — this usually takes a few seconds. Refresh this page in a moment.'}
        </p>
        <Link href={`/foundation-plus/${kid!.id}`} className="fp-label mt-10 inline-block bg-white px-8 py-4 text-xs text-[#0b0b0c] hover:bg-white/85">Open {kid!.firstName}’s player page →</Link>
      </div>
    </div>
  )
}
