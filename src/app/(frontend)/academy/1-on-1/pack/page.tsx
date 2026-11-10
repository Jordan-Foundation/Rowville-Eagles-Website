import type { Metadata } from 'next'
import Link from 'next/link'
import { payload, formatAUD, formatDate } from '@/lib/payload'
import { casualSlots } from '@/academy/slots'
import { loadTermBookingData, openTerms, releaseExpiredHolds } from '@/academy/booking-data'
import { isHolidayTimeframe } from '@/academy/timeframes'
import { packSettings } from '@/academy/packs'
import { PackPicker } from './PackPicker'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Holiday 1-on-1 pack', description: 'Book a pack of 1-on-1 sessions over the school holidays — any times that suit you, at a lower price per session.' }

/** Holiday pack: pick a coach, then the pack size and that many times across the break. */
export default async function PackPage({ searchParams }: { searchParams: Promise<{ tf?: string; coach?: string }> }) {
  const sp = await searchParams
  const p = await payload()
  await releaseExpiredHolds(p)
  const terms = (await openTerms(p)).filter(isHolidayTimeframe)
  const term = terms.find((t) => String(t.id) === sp.tf) ?? terms[0]
  if (!term) {
    return (
      <div data-brand="academy" data-page-brand="academy" className="container-x py-16">
        <h1 className="font-display text-4xl font-semibold uppercase">Holiday packs</h1>
        <p className="panel mt-6 border border-line p-6 text-muted">Holiday packs open when school holiday bookings do. <Link href="/academy/1-on-1" className="underline">Book a 1-on-1</Link></p>
      </div>
    )
  }
  const pack = packSettings(term)
  const data = await loadTermBookingData(p, term)
  const slots = casualSlots({ term, coaches: data.availability, taken: data.taken, now: new Date(), cutoffHours: term.bookingCutoffHours ?? 24 })
  const counts = new Map(data.coaches.map((c) => [c.id, slots.filter((s) => s.coachIds.includes(c.id)).length]))
  const coach = data.coaches.find((c) => String(c.id) === sp.coach)
  const minSize = pack.sizes[0]
  return (
    <div data-brand="academy" data-page-brand="academy">
      <div className="container-x space-y-8 py-12">
        <div>
          <Link href={`/academy/1-on-1?tf=${term.id}`} className="text-sm text-muted hover:text-ink">← 1-on-1 coaching</Link>
          <p className="mt-6 text-xs font-medium uppercase tracking-[0.35em] text-muted">{term.name}</p>
          <h1 className="mt-2 font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">Holiday 1-on-1 pack</h1>
          <p className="mt-3 max-w-2xl text-muted">
            {pack.sizes.join(' or ')} sessions at {formatAUD(pack.price)} each (casual sessions are {formatAUD(term.casualPrice)}). Choose any free times with one coach between {formatDate(term.startDate, { day: 'numeric', month: 'short' })} and {formatDate(term.endDate, { day: 'numeric', month: 'short' })} — they don’t need to be the same day or time. Paid upfront.
          </p>
        </div>
        {!coach ? (
          <section aria-label="Choose a coach">
            <h2 className="font-display text-2xl font-semibold uppercase">1. Choose a coach</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.coaches.map((c) => {
                const n = counts.get(c.id) ?? 0
                return (
                  <li key={c.id} className="panel border border-line p-4">
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-sm text-muted">{n} free time{n === 1 ? '' : 's'} these holidays</p>
                    {n >= minSize ? <Link href={`/academy/1-on-1/pack?tf=${term.id}&coach=${c.id}`} className="mt-3 inline-block text-sm font-semibold underline">Choose {c.name.replace(/^Coach /, '')}</Link> : <p className="mt-3 text-xs text-muted">Not enough free times for a pack</p>}
                  </li>
                )
              })}
            </ul>
          </section>
        ) : (
          <section aria-label="Choose your times">
            <h2 className="font-display text-2xl font-semibold uppercase">2. Choose your times</h2>
            <p className="mb-4 text-sm text-muted"><Link href={`/academy/1-on-1/pack?tf=${term.id}`} className="underline">Change coach</Link></p>
            <PackPicker
              coachId={coach.id}
              coachName={coach.name}
              sizes={pack.sizes}
              price={pack.price}
              casual={term.casualPrice}
              times={slots.filter((s) => s.coachIds.includes(coach.id)).map((s) => ({ startsAt: s.startsAt, day: formatDate(s.startsAt, { weekday: 'short', day: 'numeric', month: 'short' }), time: formatDate(s.startsAt, { hour: 'numeric', minute: '2-digit' }) }))}
            />
          </section>
        )}
      </div>
    </div>
  )
}
