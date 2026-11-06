import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { payload, formatAUD, formatDate } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { isCasualOpen } from '@/academy/slots'
import { loadTermBookingData, openTerms, releaseAcademyHold, releaseExpiredHolds } from '@/academy/booking-data'
import { BookForm } from './BookForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Book a 1-on-1', robots: { index: false } }

export default async function BookPage({ searchParams }: { searchParams: Promise<{ coach?: string; start?: string; cancelled?: string }> }) {
  const { coach: coachRaw, start, cancelled } = await searchParams
  const p = await payload()
  if (cancelled) {
    // Came back from Stripe without paying — free that exact time straight away
    const held = (await p.find({ collection: 'academy-bookings', where: { reference: { equals: cancelled }, status: { equals: 'held' } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
    const sameSlot = held && String(typeof held.coach === 'object' ? held.coach.id : held.coach) === coachRaw && held.firstSessionAt && start && new Date(held.firstSessionAt).getTime() === new Date(start).getTime()
    if (sameSlot) await releaseAcademyHold(p, cancelled)
  }
  await releaseExpiredHolds(p)
  const user = await currentUser()
  const coachId = Number(coachRaw)
  const term = (await openTerms(p)).find((t) => start && start >= t.startDate && start <= t.endDate)
  const data = term ? await loadTermBookingData(p, term) : null
  const open = Boolean(term && data && start && coachId && isCasualOpen({ term, coaches: data.availability, taken: data.taken, now: new Date(), cutoffHours: term.bookingCutoffHours ?? 24, coachId, startsAt: start }))
  const coach = data?.coaches.find((c) => c.id === coachId)
  const players = user ? (await p.find({ collection: 'participants', where: { account: { equals: user.id } }, depth: 0, limit: 20, overrideAccess: true })).docs.map((k) => ({ id: k.id, name: `${k.firstName} ${k.lastName}` })) : []

  return (
    <div data-brand="academy" data-page-brand="academy">
      <div className="container-x grid gap-10 py-12 lg:grid-cols-[1fr_22rem]">
        <div>
          <Link href="/academy/1-on-1" className="text-sm text-muted hover:text-ink">← All times</Link>
          <h1 className="mt-4 font-display text-4xl font-semibold uppercase tracking-tight">Book your 1-on-1</h1>
          {cancelled && <p className="panel mt-6 border border-line px-4 py-3 text-sm">Payment was cancelled — nothing was charged.</p>}
          <div className="mt-8">
            {open && term && coach && start ? (
              <BookForm coach={coachId} start={start} term={term.id} price={formatAUD(term.casualPrice)} me={user ? { firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone } : null} players={players} />
            ) : (
              <p className="panel border border-line p-6">
                That time isn’t available any more. <Link href="/academy/1-on-1" className="font-semibold underline">Choose another time</Link>.
              </p>
            )}
          </div>
        </div>
        {open && term && coach && start && (
          <aside className="panel gloss-sheen h-fit border border-line lg:sticky lg:top-24">
            <div className="relative aspect-[4/3] bg-surface-2">{coach.photo && <Image src={coach.photo} alt={coach.name} fill sizes="22rem" className="object-cover" />}</div>
            <div className="p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">Casual 1-on-1</p>
              <p className="mt-2 font-display text-2xl font-semibold uppercase">{coach.name}</p>
              <p className="mt-3 text-sm">{formatDate(start, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              <p className="text-sm">{formatDate(start, { hour: 'numeric', minute: '2-digit' })} · {term.sessionMinutes} minutes</p>
              <p className="mt-1 text-sm text-muted">{term.location}</p>
              <div className="mt-5 flex items-baseline justify-between border-t border-line pt-4">
                <span className="text-muted">Total</span>
                <span className="font-display text-3xl font-semibold">{formatAUD(term.casualPrice)}</span>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
