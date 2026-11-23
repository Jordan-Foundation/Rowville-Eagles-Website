import type { Metadata } from 'next'
import { payload, formatAUD, formatDate } from '@/lib/payload'
import { getAgeRules } from '@/lib/age-rules'
import { currentAcademyTerm, trialNights } from '@/lib/rfa-trials'
import { AcademyBackdrop } from '@/components/AcademyBackdrop'
import { RfaLogo } from '@/components/Logos'
import { RfaTrialForm } from './RfaTrialForm'
import { contactPrefill, familyKids } from '@/lib/family-kids'
import { currentUser } from '@/lib/auth'
import { StickyCta } from '@/components/StickyCta'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Book an RFA trial',
  description: 'Book a trial night with the Rowville Foundation Academy — limited spots per age group each night.',
}

export default async function RfaTrialPage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const { cancelled } = await searchParams
  const p = await payload()
  const me = await currentUser()
  const [term, settings] = await Promise.all([currentAcademyTerm(p), p.findGlobal({ slug: 'site-settings', depth: 0 })])
  const nights = term ? await trialNights(p, term) : []
  const open = !!term && nights.length > 0
  const price = term?.trialPrice ?? 0
  const priceText = price > 0 ? formatAUD(price) : 'Free'

  return (
    <div data-brand="academy" data-page-brand="academy">
      <section className="relative overflow-hidden border-b border-line">
        <AcademyBackdrop size="md" />
        <div className="container-x relative py-16 md:py-24">
          <RfaLogo className="h-12 w-auto" ink="#fff" paper="#000" />
          <p className="mt-8 text-xs font-medium uppercase tracking-[0.35em] text-muted">Trial session</p>
          <h1 className="mt-3 max-w-3xl font-display text-5xl font-semibold uppercase leading-[0.95] tracking-tight sm:text-6xl">Train with the Academy</h1>
          {term && (
            <p className="mt-5 max-w-2xl text-lg text-muted">
              Join a session of <span className="text-ink">{term.title}</span>
              {term.startDate && ` (from ${formatDate(term.startDate)})`}. Trial spots are limited to {term.trialPlacesPerNight ?? 2} players per age group each night, and each player can book one trial.
            </p>
          )}
          {open && (
            <>
              <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-ink" data-trial-offer>
                {price > 0 ? `Trial ${priceText}` : 'Free trial · no payment needed'} · book in 2 minutes
              </p>
              <a href="#book" data-cta className="mt-5 inline-block bg-white px-7 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-black transition hover:bg-white/85">
                Choose a trial night →
              </a>
            </>
          )}
        </div>
      </section>
      <div id="book" data-cta-zone className="container-x max-w-3xl scroll-mt-20 py-14">
        {cancelled && <p className="panel mb-6 border border-line bg-surface-2 px-4 py-3 text-sm">Payment was cancelled — nothing was charged.</p>}
        {open ? (
          <RfaTrialForm rules={await getAgeRules(p)} nights={nights} priceLabel={formatAUD(term.trialPrice ?? 0)} kids={await familyKids(p, me?.id)} prefill={contactPrefill(me)} />
        ) : (
          <p className="panel border border-line bg-surface-2 p-6 text-muted">Trial nights for the next Academy term will open soon.</p>
        )}
      </div>
      {open && <StickyCta academy href="#book" label={price > 0 ? 'Book a trial' : 'Book free trial'} note={`${priceText} · limited spots each night`} />}
    </div>
  )
}
