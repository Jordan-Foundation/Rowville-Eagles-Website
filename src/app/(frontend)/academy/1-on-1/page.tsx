import type { Metadata } from 'next'
import { payload, formatAUD, formatDate } from '@/lib/payload'
import { casualSlots, termSlots } from '@/academy/slots'
import { loadTermBookingData, openTerms, releaseExpiredHolds } from '@/academy/booking-data'
import { AcademyBackdrop } from '@/components/AcademyBackdrop'
import { RfaLogo } from '@/components/Logos'
import { SlotBrowser } from './SlotBrowser'
import { currentUser } from '@/lib/auth'
import { isTermMember, memberWindowEnd } from '@/academy/pricing'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: '1-on-1 coaching',
  description: 'Book a 1-on-1 session with a Foundation Academy coach — pick a time, see which coaches are free, and book online.',
}

export default async function OneOnOnePage({ searchParams }: { searchParams: Promise<{ mode?: string; link?: string }> }) {
  const sp = await searchParams
  const mode = sp.mode === 'term' ? 'term' : 'casual'
  const p = await payload()
  await releaseExpiredHolds(p)
  const terms = await openTerms(p)
  const term = terms[0]
  const data = term ? await loadTermBookingData(p, term) : null
  const engine = term && data ? { term, coaches: data.availability, taken: data.taken, now: new Date(), cutoffHours: term.bookingCutoffHours ?? 24 } : null
  const slots = engine ? casualSlots(engine) : []
  const weekly = engine ? termSlots({ ...engine, minSessions: term!.minTermSessions ?? 2 }) : []
  // Families with an active term booking: lower casual price for the next couple of weeks
  const user = await currentUser()
  const now = new Date()
  const member =
    term && term.termMemberPrice != null && term.termMemberPrice < term.casualPrice && (await isTermMember(p, user?.id, now))
      ? { price: term.termMemberPrice, until: memberWindowEnd(term, now).toISOString() }
      : null

  return (
    <div data-brand="academy" data-page-brand="academy">
      <section className="relative overflow-hidden border-b border-line">
        <AcademyBackdrop size="md" />
        <div className="container-x relative py-16 md:py-20">
          <RfaLogo className="h-10 w-auto" ink="#fff" paper="#000" />
          <p className="mt-8 text-xs font-medium uppercase tracking-[0.35em] text-muted">Foundation Academy</p>
          <h1 className="mt-3 max-w-3xl font-display text-5xl font-semibold uppercase leading-[0.95] tracking-tight sm:text-6xl">1-on-1 coaching</h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            Pick a time, see which coaches are free, and choose the one that suits your player. {term ? `${term.sessionMinutes}-minute sessions.` : ''}
          </p>
          {term && (
            <div className="mt-8 flex flex-wrap gap-3 text-sm" role="tablist" aria-label="Booking type">
              <a href="/academy/1-on-1" role="tab" aria-selected={mode === 'casual'} className={`px-4 py-2 ${mode === 'casual' ? 'bg-white text-black' : 'border border-line text-muted hover:text-ink'}`}>
                Casual session · <strong>{formatAUD(term.casualPrice)}</strong>
                {member && <> · <strong>{formatAUD(member.price)}</strong> for you</>}
              </a>
              <a href="/academy/1-on-1?mode=term" role="tab" aria-selected={mode === 'term'} className={`px-4 py-2 ${mode === 'term' ? 'bg-white text-black' : 'border border-line text-muted hover:text-ink'}`}>
                Whole term · <strong>{formatAUD(term.pricePerSession)}</strong>/session
              </a>
            </div>
          )}
          {term && (
            <dl className="mt-6 grid max-w-3xl gap-3 text-sm sm:grid-cols-2">
              <div className={`border p-4 ${mode === 'casual' ? 'border-white/60' : 'border-line'}`}>
                <dt className="font-semibold">Casual session</dt>
                <dd className="mt-1 text-muted">One session, any free time. Good for trying a coach or a one-off boost.</dd>
              </div>
              <div className={`border p-4 ${mode === 'term' ? 'border-white/60' : 'border-line'}`}>
                <dt className="font-semibold">Whole term</dt>
                <dd className="mt-1 text-muted">The same coach, day and time every week for the rest of term, at a lower price per session. Pay upfront, or weekly when enough of the term is left.</dd>
              </div>
            </dl>
          )}
        </div>
      </section>
      <div className="container-x py-12">
        {sp.link === 'expired' && <p role="note" className="panel mb-8 border border-line px-5 py-4 text-sm">That booking link has expired or has already been used — choose a time below, or ask your coach to send a new one.</p>}
        {!term || !data ? (
          <p className="panel border border-line p-6 text-muted">1-on-1 bookings for the next term open soon.</p>
        ) : (mode === 'term' ? weekly : slots).length === 0 ? (
          <p className="panel border border-line p-6 text-muted">
            {mode === 'term' ? `No weekly times are free for the rest of ${term.name} — try a casual session instead.` : `All ${term.name} sessions are booked out for now — please check back soon.`}
          </p>
        ) : (
          <>
            {member && mode === 'casual' && (
              <p className="panel mb-6 border border-white/40 px-5 py-4 text-sm">
                <strong>Term member price:</strong> as you have a term booking, casual sessions in the next {term.termMemberWindowDays ?? 14} days are{' '}
                <strong>{formatAUD(member.price)}</strong> (normally {formatAUD(term.casualPrice)}) — up to {formatDate(member.until, { weekday: 'short', day: 'numeric', month: 'short' })}.
              </p>
            )}
            <p className="mb-6 text-sm text-muted">
              {term.name}: {formatDate(term.startDate)} – {formatDate(term.endDate)} ·{' '}
              {mode === 'term'
                ? `the same coach, day and time every week for the rest of term — ${formatAUD(term.pricePerSession)} × sessions left`
                : `bookings close ${term.bookingCutoffHours ?? 24} hours before each session`}{' '}
              · all times Sydney/Melbourne time
            </p>
            <SlotBrowser
              mode={mode}
              slots={slots}
              weekly={weekly}
              coaches={data.coaches}
              casualPrice={term.casualPrice}
              pricePerSession={term.pricePerSession}
              member={member}
            />
          </>
        )}
      </div>
    </div>
  )
}
