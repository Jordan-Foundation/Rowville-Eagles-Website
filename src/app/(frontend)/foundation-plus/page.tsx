import Link from 'next/link'
import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { foundationSettings, isStaffOrCoach } from '@/academy/pdr/load'
import { FoundationPlusLogo } from '@/components/FoundationPlusLogo'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Foundation+ — online football training',
  description: 'Foundation Academy’s online training platform: levelled drills, video challenges checked by coaches, badges and leaderboards.',
  alternates: { canonical: '/foundation-plus' },
}

/** Public Foundation+ page (the full marketing page arrives in the next stage). Members get a shortcut to their player pages. */
export default async function FoundationPlusHome() {
  const p = await payload()
  const [settings, user] = await Promise.all([foundationSettings(p), currentUser()])
  const live = settings.enabled || isStaffOrCoach(user)
  const kids = user && live ? (await p.find({ collection: 'participants', where: { account: { equals: user.id } }, sort: 'firstName', depth: 0, limit: 20, overrideAccess: true })).docs : []
  return (
    <div className="fp-ink">
      <section className="container-x py-20 sm:py-28">
        <FoundationPlusLogo variant="horizontal" tone="white" height={48} alt="Foundation+" />
        <h1 className="fp-heading mt-10 max-w-3xl text-5xl leading-[0.95] sm:text-7xl">Level up. Every day.</h1>
        <p className="mt-6 max-w-xl text-lg text-white/75">Foundation Academy’s online training platform — levelled drills, video challenges checked by our coaches, badges and leaderboards.</p>
        {!settings.enabled && <p className="fp-label mt-8 inline-block border border-white/30 px-4 py-2 text-xs">Coming soon</p>}
        {kids.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-3">
            {kids.map((k) => (
              <Link key={k.id} href={`/foundation-plus/${k.id}`} className="fp-label bg-white px-6 py-3 text-xs text-[#0b0b0c] hover:bg-white/85">
                Open {k.firstName}’s player page →
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
