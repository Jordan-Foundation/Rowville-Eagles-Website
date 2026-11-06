import type { Metadata } from 'next'
import { payload, formatAUD, formatDate } from '@/lib/payload'
import { casualSlots } from '@/academy/slots'
import { loadTermBookingData, openTerms, releaseExpiredHolds } from '@/academy/booking-data'
import { AcademyBackdrop } from '@/components/AcademyBackdrop'
import { RfaLogo } from '@/components/Logos'
import { SlotBrowser } from './SlotBrowser'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: '1-on-1 coaching',
  description: 'Book a 1-on-1 session with a Foundation Academy coach — choose a time, meet the coaches free then, and book online.',
}

export default async function OneOnOnePage() {
  const p = await payload()
  await releaseExpiredHolds(p)
  const terms = await openTerms(p)
  const term = terms[0]
  const data = term ? await loadTermBookingData(p, term) : null
  const slots = term && data ? casualSlots({ term, coaches: data.availability, taken: data.taken, now: new Date(), cutoffHours: term.bookingCutoffHours ?? 24 }) : []

  return (
    <div data-brand="academy" data-page-brand="academy">
      <section className="relative overflow-hidden border-b border-line">
        <AcademyBackdrop size="md" />
        <div className="container-x relative py-16 md:py-20">
          <RfaLogo className="h-10 w-auto" ink="#fff" paper="#000" />
          <p className="mt-8 text-xs font-medium uppercase tracking-[0.35em] text-muted">Foundation Academy</p>
          <h1 className="mt-3 max-w-3xl font-display text-5xl font-semibold uppercase leading-[0.95] tracking-tight sm:text-6xl">1-on-1 coaching</h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            Pick a time, meet the coaches free then, and choose the one that suits your player. {term ? `${term.sessionMinutes}-minute sessions.` : ''}
          </p>
          {term && (
            <div className="mt-8 flex flex-wrap gap-3 text-sm">
              <span className="border border-white/30 px-4 py-2">Casual session · <strong>{formatAUD(term.casualPrice)}</strong></span>
              <span className="border border-line px-4 py-2 text-muted">Whole-term bookings ({formatAUD(term.pricePerSession)}/session) — opening soon</span>
            </div>
          )}
        </div>
      </section>
      <div className="container-x py-12">
        {!term || !data ? (
          <p className="panel border border-line p-6 text-muted">1-on-1 bookings for the next term open soon.</p>
        ) : slots.length === 0 ? (
          <p className="panel border border-line p-6 text-muted">All {term.name} sessions are booked out for now — please check back soon.</p>
        ) : (
          <>
            <p className="mb-6 text-sm text-muted">
              {term.name}: {formatDate(term.startDate)} – {formatDate(term.endDate)} · bookings close {term.bookingCutoffHours ?? 24} hours before each session · all times Sydney/Melbourne time
            </p>
            <SlotBrowser slots={slots} coaches={data.coaches} price={formatAUD(term.casualPrice)} />
          </>
        )}
      </div>
    </div>
  )
}
