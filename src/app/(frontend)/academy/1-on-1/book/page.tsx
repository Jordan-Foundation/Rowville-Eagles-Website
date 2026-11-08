import Image from 'next/image'
import { PromoNotice } from '@/promotions/PromoNotice'
import Link from 'next/link'
import type { Metadata } from 'next'
import { payload, formatAUD, formatDate } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { findTermSlot, isCasualOpen } from '@/academy/slots'
import { loadTermBookingData, openTerms, releaseAcademyHold, releaseExpiredHolds } from '@/academy/booking-data'
import { toYmd } from '@/academy/term-dates'
import { weeklyPlan } from '@/academy/weekly'
import { creditBalance } from '@/academy/credits'
import { casualPrice, isTermMember } from '@/academy/pricing'
import { BookForm } from './BookForm'
import { activeHold, findShareLink, linkMatches } from '@/academy/share-links'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Book a 1-on-1', robots: { index: false } }

type Search = { mode?: string; coach?: string; start?: string; weekday?: string; time?: string; cancelled?: string; share?: string }

/** "Mon 1 Mar – Sun 7 Mar" style ranges from consecutive away session dates. */
function awayRanges(dates: string[], periods: { from: string; to: string }[]) {
  const hit = periods.filter((p) => dates.some((d) => d >= toYmd(p.from) && d <= toYmd(p.to)))
  const fmt = (iso: string) => formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short' })
  return hit.map((p) => (toYmd(p.from) === toYmd(p.to) ? fmt(p.from) : `${fmt(p.from)} to ${fmt(p.to)}`))
}

export default async function BookPage({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams
  const mode = q.mode === 'term' ? 'term' : 'casual'
  const p = await payload()
  if (q.cancelled) {
    // Came back from Stripe without paying — free that exact hold straight away
    const held = (await p.find({ collection: 'academy-bookings', where: { reference: { equals: q.cancelled }, status: { equals: 'held' } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
    const sameCoach = held && String(typeof held.coach === 'object' ? held.coach.id : held.coach) === q.coach
    const sameSlot = mode === 'term' ? held?.weekday === q.weekday && held?.startTime === q.time : held?.firstSessionAt && q.start && new Date(held.firstSessionAt).getTime() === new Date(q.start).getTime()
    if (sameCoach && sameSlot) await releaseAcademyHold(p, q.cancelled)
  }
  await releaseExpiredHolds(p)
  const user = await currentUser()
  const coachId = Number(q.coach)
  const terms = await openTerms(p)
  const term = mode === 'term' ? terms[0] : terms.find((t) => q.start && q.start >= t.startDate && q.start <= t.endDate)
  // A coach's share link: the time they reserved is free for this family, and their details are filled in
  const shareLink = q.share ? await findShareLink(p, q.share) : null
  const share = shareLink && linkMatches(shareLink, { mode, coach: coachId, start: q.start, weekday: q.weekday, time: q.time }) ? shareLink : null
  const shareHold = share ? await activeHold(p, share) : null
  const data = term ? await loadTermBookingData(p, term, { ignoreBooking: shareHold?.id }) : null
  const engine = term && data ? { term, coaches: data.availability, taken: data.taken, now: new Date(), cutoffHours: term.bookingCutoffHours ?? 24 } : null

  const termSlot = engine && mode === 'term' && q.weekday && q.time ? findTermSlot({ ...engine, minSessions: term!.minTermSessions ?? 2, coachId, weekday: q.weekday, time: q.time }) : null
  const casualOpen = Boolean(engine && mode === 'casual' && q.start && isCasualOpen({ ...engine, coachId, startsAt: q.start }))
  const open = mode === 'term' ? Boolean(termSlot) : casualOpen
  const coach = data?.coaches.find((c) => c.id === coachId)
  const players = user ? (await p.find({ collection: 'participants', where: { account: { equals: user.id } }, depth: 0, limit: 20, overrideAccess: true })).docs.map((k) => ({ id: k.id, name: `${k.firstName} ${k.lastName}` })) : []

  const sessions = termSlot?.sessions ?? (q.start ? [q.start] : [])
  const awayDates = new Set(termSlot?.awayDates[coachId] ?? [])
  const coachAway = data?.availability.find((a) => a.coachId === coachId)?.away ?? []
  const ranges = termSlot && awayDates.size ? awayRanges([...awayDates], coachAway) : []
  const priced = term && mode === 'casual' && q.start ? casualPrice(term, { startsAt: new Date(q.start).toISOString(), now: new Date(), termMember: await isTermMember(p, user?.id) }) : null
  const total = term ? (mode === 'term' ? term.pricePerSession * sessions.length : (priced?.price ?? term.casualPrice)) : 0
  const plan = termSlot ? weeklyPlan(sessions) : null
  const short = (iso: string) => formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short' })
  const weekly =
    plan && term
      ? { perSession: formatAUD(term.pricePerSession), total: formatAUD(total), laterPayments: plan.recurringCharges, firstCharge: short(plan.chargeDates[1]), lastCharge: short(plan.chargeDates.at(-1)!) }
      : null

  return (
    <div data-brand="academy" data-page-brand="academy">
      <div className="container-x grid gap-10 py-12 lg:grid-cols-[1fr_22rem]">
        <div>
          <Link href={`/academy/1-on-1${mode === 'term' ? '?mode=term' : ''}`} className="text-sm text-muted hover:text-ink">← All times</Link>
          <h1 className="mt-4 font-display text-4xl font-semibold uppercase tracking-tight">{mode === 'term' ? 'Book your term of 1-on-1s' : 'Book your 1-on-1'}</h1>
          {term && <div className="mt-6"><PromoNotice tone="dark" targets={[{ kind: '1on1', termId: term.id }]} /></div>}
          {q.cancelled && <p className="panel mt-6 border border-line px-4 py-3 text-sm">Payment was cancelled — nothing was charged.</p>}
          {share && open && coach && (
            <div role="note" className="panel mt-6 border border-white/40 p-5 text-sm">
              <p className="font-semibold">{coach.name} sent you this time{share.client.playerFirstName ? ` for ${share.client.playerFirstName}` : ''}.</p>
              {shareHold?.holdExpiresAt && <p className="mt-1 text-muted">It’s held for you until {formatDate(share.holdUntil ?? shareHold.holdExpiresAt, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}.</p>}
              {share.message && <p className="mt-3 whitespace-pre-line italic">“{share.message}”</p>}
            </div>
          )}

          {open && coach && ranges.length > 0 && (
            <div role="note" className="mt-6 border-2 border-white/60 p-5 text-sm leading-relaxed">
              <p className="font-semibold uppercase tracking-wider">Coach away during this term</p>
              <p className="mt-2">
                {coach.name} will be away from {ranges.join(' and ')}. A suitable replacement coach will be allocated for{' '}
                {awayDates.size === 1 ? 'this session' : `these ${awayDates.size} sessions`}, with a detailed handover from {coach.name} to make sure progress is
                still made in their absence.
              </p>
            </div>
          )}

          <div className="mt-8">
            {open && term && coach ? (
              <BookForm
                coach={coachId}
                term={term.id}
                slot={mode === 'term' ? { mode: 'term', weekday: termSlot!.weekday, time: termSlot!.time, sessions: sessions.length } : { mode: 'casual', start: q.start! }}
                price={formatAUD(total)}
                weekly={weekly}
                credit={user ? { balance: await creditBalance(p, user.id), total, sessions: sessions.length } : undefined}
                loginHref={`/login?next=${encodeURIComponent(`/academy/1-on-1/book?${new URLSearchParams(Object.entries(q).filter(([k, v]) => k !== 'cancelled' && v) as [string, string][]).toString()}`)}`}
                me={user ? { firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone } : null}
                players={players}
                share={share && !user ? { token: q.share!, prefill: { contactFirstName: share.client.firstName, contactLastName: share.client.lastName, contactEmail: share.client.email, contactMobile: share.client.mobile ?? '', playerFirstName: share.client.playerFirstName ?? '', playerLastName: share.client.lastName } } : share ? { token: q.share!, prefill: {} } : undefined}
              />
            ) : (
              <p className="panel border border-line p-6">
                That {mode === 'term' ? 'weekly time' : 'time'} isn’t available any more. <Link href={`/academy/1-on-1${mode === 'term' ? '?mode=term' : ''}`} className="font-semibold underline">Choose another</Link>.
              </p>
            )}
          </div>
        </div>

        {open && term && coach && (
          <aside className="panel gloss-sheen h-fit border border-line lg:sticky lg:top-24">
            <div className="relative aspect-[4/3] bg-surface-2">{coach.photo && <Image src={coach.photo} alt={coach.name} fill sizes="22rem" className="object-cover" />}</div>
            <div className="p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">{mode === 'term' ? `${term.name} · weekly` : 'Casual 1-on-1'}</p>
              <p className="mt-2 font-display text-2xl font-semibold uppercase">{coach.name}</p>
              {mode === 'term' ? (
                <>
                  <p className="mt-3 text-sm">{termSlot!.weekday}s at {formatDate(sessions[0], { hour: 'numeric', minute: '2-digit' })} · {term.sessionMinutes} min</p>
                  <p className="mt-1 text-sm text-muted">{term.location}</p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted">Your {sessions.length} sessions</p>
                  <ol className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                    {sessions.map((iso) => (
                      <li key={iso} className={awayDates.has(toYmd(iso)) ? 'text-muted' : ''}>
                        {formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short' })}
                        {awayDates.has(toYmd(iso)) && <span className="block text-[11px] uppercase tracking-wider">Replacement coach</span>}
                      </li>
                    ))}
                  </ol>
                  <div className="mt-5 space-y-1 border-t border-line pt-4 text-sm">
                    <div className="flex justify-between text-muted"><span>{formatAUD(term.pricePerSession)} × {sessions.length} sessions</span><span>{formatAUD(total)}</span></div>
                    <div className="flex items-baseline justify-between pt-1"><span className="text-muted">Total</span><span className="font-display text-3xl font-semibold text-ink">{formatAUD(total)}</span></div>
                    {weekly && <p className="pt-1 text-xs text-muted">or {weekly.perSession} a week — choose below</p>}
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm">{formatDate(q.start!, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                  <p className="text-sm">{formatDate(q.start!, { hour: 'numeric', minute: '2-digit' })} · {term.sessionMinutes} minutes</p>
                  <p className="mt-1 text-sm text-muted">{term.location}</p>
                  {priced?.memberPrice && (
                    <div className="mt-5 flex justify-between border-t border-line pt-4 text-sm text-muted">
                      <span>Term member price</span>
                      <span><s>{formatAUD(term.casualPrice)}</s> {formatAUD(total)}</span>
                    </div>
                  )}
                  <div className="mt-5 flex items-baseline justify-between border-t border-line pt-4">
                    <span className="text-muted">Total</span>
                    <span className="font-display text-3xl font-semibold">{formatAUD(total)}</span>
                  </div>
                </>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
