import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { payload, formatAUD, formatDate } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { hasRole } from '@/access'
import { academyBrand } from '@/academy/brand'
import { cashPaid } from '@/academy/cancellation'
import { sessionPayment } from '@/academy/session-view'
import type { AcademyCoach, AcademyTerm, Program } from '@/payload-types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Booking', robots: { index: false } }

/** "17:00" → "5:00 pm" */
const clock = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}
const owner = (v: number | { id: number } | null | undefined) => (v && typeof v === 'object' ? v.id : (v ?? null))
const sessionLabel: Record<string, string> = { scheduled: 'Booked', completed: 'Attended', no_show: 'Missed', cancelled: 'Cancelled', held: 'Held' }
const bookingLabel: Record<string, string> = {
  confirmed: 'Confirmed', payment_failed: 'Payment needed', completed: 'Completed', cancelled: 'Cancelled', refunded: 'Cancelled & refunded',
  paid: 'Confirmed', pending: 'Awaiting payment', expired: 'Not paid in time', held: 'Awaiting payment',
}

/** One booking, for the family that made it — 1-on-1s (academy) or programs, camps and trials (club). */
export default async function MyBookingPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params
  const user = await currentUser()
  if (!user) redirect(`/login?next=/account/bookings/${ref}`)
  const p = await payload()
  const staff = hasRole(user, 'admin', 'committee')

  const academy = (await p.find({ collection: 'academy-bookings', where: { reference: { equals: ref } }, limit: 1, depth: 1, overrideAccess: true })).docs[0]
  if (academy) {
    if (owner(academy.account) !== user.id && !staff) notFound()
    const b = academy
    const coach = b.coach as AcademyCoach
    const term = b.term as AcademyTerm
    const { docs: sessions } = await p.find({ collection: 'academy-sessions', where: { booking: { equals: b.id }, status: { not_equals: 'held' } }, sort: 'startsAt', limit: 100, depth: 1, overrideAccess: true })
    const payUrl = b.status === 'payment_failed' ? (b.payments ?? []).filter((x) => x.status === 'failed').at(-1)?.payUrl : null
    const per = b.amount / (b.sessionsTotal || 1)
    const card = cashPaid({ ...b, sessionsTotal: b.sessionsTotal ?? 1 })
    const money: [string, string][] = [
      ['Price', b.type === 'term' ? `${formatAUD(b.amount)} (${b.sessionsTotal} × ${formatAUD(per)})` : formatAUD(b.amount)],
      ...(b.paymentMode === 'weekly' ? ([['Weekly payments', `${b.sessionsPaid ?? 0} of ${b.sessionsTotal} paid${b.nextChargeAt ? ` · next ${formatDate(b.nextChargeAt, { weekday: 'short', day: 'numeric', month: 'short' })}` : ''}`]] as [string, string][]) : []),
      ...((b.creditSessionsUsed ?? 0) > 0 ? ([['Session credits used', String(b.creditSessionsUsed)]] as [string, string][]) : []),
      ['Paid by card', card > 0 ? formatAUD(card) : '$0'],
      ...((b.refundedAmount ?? 0) > 0 ? ([['Refunded to your card', formatAUD(b.refundedAmount!)]] as [string, string][]) : []),
      ...((b.creditedSessions ?? 0) > 0 ? ([['Returned as session credits', String(b.creditedSessions)]] as [string, string][]) : []),
    ]

    return (
      <div data-brand="academy" data-page-brand="academy">
        <div className="container-x max-w-4xl space-y-8 py-14">
          <div>
            <Link href="/account" className="text-sm text-muted hover:text-ink">← My account</Link>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.3em] text-muted">Foundation Academy · {b.reference}</p>
            <h1 className="mt-2 font-display text-4xl font-semibold uppercase tracking-tight">
              {b.type === 'term' ? 'Term of 1-on-1s' : '1-on-1 session'} — {b.player.firstName}
            </h1>
            <p className="mt-2 text-muted">
              with {coach.displayName}
              {b.type === 'term' && b.weekday && b.startTime ? ` · ${b.weekday}s at ${clock(b.startTime)}` : ''} · {term.sessionMinutes} min · {term.location || academyBrand.address}
            </p>
            <p className={`mt-3 inline-block px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${b.status === 'payment_failed' ? 'bg-red-500/20 text-red-300' : 'border border-line'}`}>{bookingLabel[b.status] ?? b.status}</p>
          </div>

          {payUrl && (
            <div className="flex flex-wrap items-center justify-between gap-4 border-2 border-red-400/60 p-5">
              <p className="text-sm">This week’s automatic payment didn’t go through. Please pay so {b.player.firstName} keeps their weekly time.</p>
              <a href={payUrl} className="bg-white px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.15em] text-black">Pay now</a>
            </div>
          )}

          <section className="panel border border-line">
            <h2 className="border-b border-line px-5 py-4 font-display text-xl font-semibold uppercase">Sessions</h2>
            <ol className="divide-y divide-line">
              {sessions.map((s) => {
                const cover = s.needsCover ? (s.coverCoach && typeof s.coverCoach === 'object' ? `Cover coach: ${s.coverCoach.displayName}` : 'Replacement coach being arranged') : null
                return (
                  <li key={s.id} className={`grid gap-1 px-5 py-4 text-sm sm:grid-cols-[14rem_1fr_auto] sm:items-center sm:gap-4 ${s.status === 'cancelled' ? 'text-muted' : ''}`}>
                    <span className={`font-medium ${s.status === 'cancelled' ? 'line-through' : ''}`}>{formatDate(s.startsAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                    <span className="text-muted">
                      {[
                        s.status === 'cancelled' ? `Cancelled${s.cancelledBy === 'coach' ? ' by the Academy' : ''}` : sessionPayment(s, b).label,
                        s.makeUpFor && 'Free make-up session',
                        cover,
                      ].filter(Boolean).join(' · ')}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider">{sessionLabel[s.status]}</span>
                  </li>
                )
              })}
            </ol>
          </section>

          <section className="panel border border-line p-5">
            <h2 className="font-display text-xl font-semibold uppercase">Payment</h2>
            <dl className="mt-3 divide-y divide-line text-sm">
              {money.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
              ))}
            </dl>
          </section>

          {['confirmed', 'payment_failed'].includes(b.status) && (
            <section className="border border-line p-5 text-sm">
              <h2 className="font-display text-xl font-semibold uppercase">Need to change or cancel?</h2>
              <p className="mt-2 text-muted">
                {b.type === 'casual'
                  ? 'Cancel 24 hours or more before the session for a refund or account credit. Inside 24 hours, no refund is given.'
                  : 'You can cancel the rest of the term at any time: unplayed sessions are refunded or credited, less one session. A single week cancelled 24 hours or more ahead is credited.'}
              </p>
              <p className="mt-3">
                Email <a href={`mailto:${academyBrand.email}?subject=${encodeURIComponent(`Booking ${b.reference}`)}`} className="font-semibold underline">{academyBrand.email}</a> or call{' '}
                <a href={`tel:${academyBrand.phone.replace(/\s+/g, '')}`} className="font-semibold underline">{academyBrand.phone}</a> with your reference <span className="font-mono">{b.reference}</span>.
              </p>
            </section>
          )}
          {staff && <p className="text-sm"><Link href={`/staff/academy/bookings/${b.id}`} className="underline">Open in staff tools (cancel, refund, credit) →</Link></p>}
        </div>
      </div>
    )
  }

  // Club bookings: programs, camps, trials, registrations
  const club = (await p.find({ collection: 'bookings', where: { reference: { equals: ref } }, limit: 1, depth: 1, overrideAccess: true })).docs[0]
  if (!club || (owner(club.account) !== user.id && !staff)) notFound()
  const prog = club.program as Program
  const rows: [string, string][] = [
    ['Player', [club.player?.firstName, club.player?.lastName].filter(Boolean).join(' ') || club.player?.teamName || '—'],
    ...(club.sessionStart
      ? ([['When', formatDate(club.sessionStart, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })]] as [string, string][])
      : prog.startDate
        ? ([['Dates', `${formatDate(prog.startDate, { day: 'numeric', month: 'short', year: 'numeric' })}${prog.endDate ? ` – ${formatDate(prog.endDate, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}`]] as [string, string][])
        : []),
    ...(prog.scheduleNote ? ([['Schedule', prog.scheduleNote]] as [string, string][]) : []),
    ...(prog.location ? ([['Where', prog.location]] as [string, string][]) : []),
    ['Paid', formatAUD(club.amount ?? 0)],
    ['Reference', club.reference ?? ''],
  ]
  return (
    <div className="container-x max-w-3xl space-y-8 py-14">
      <div>
        <Link href="/account" className="text-sm text-muted hover:text-ink">← My account</Link>
        <p className="eyebrow mt-4 !text-brand">{club.bookingType === 'trial' ? 'Trial' : 'Booking'} · {club.payee === 'academy' ? 'Foundation Academy' : 'Rowville Eagles FC'}</p>
        <h1 className="mt-2 font-[family-name:var(--font-barlow)] text-4xl font-extrabold uppercase">{prog.title}</h1>
        <p className="mt-3 inline-block rounded-full border border-line px-3 py-1 text-xs font-semibold">{bookingLabel[club.status] ?? club.status}</p>
      </div>
      <dl className="divide-y divide-line rounded-2xl border border-line px-5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-3"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
        ))}
      </dl>
      <p className="text-sm">
        <Link href={`/programs/${prog.slug}`} className="font-semibold text-brand underline">About this program</Link>
        <span className="text-muted"> · Questions? Email <a href={`mailto:${club.payee === 'academy' ? academyBrand.email : 'refc.secretary@outlook.com'}`} className="underline">{club.payee === 'academy' ? academyBrand.email : 'refc.secretary@outlook.com'}</a> with your reference.</span>
      </p>
    </div>
  )
}
