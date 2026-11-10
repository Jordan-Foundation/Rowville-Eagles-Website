import { BookingNextSteps } from '@/components/BookingNextSteps'
import { programPlace } from '@/lib/place'
import Link from 'next/link'
import type { Metadata } from 'next'
import { payload, formatAUD, formatDate } from '@/lib/payload'
import { confirmAcademyBooking } from '@/academy/booking-data'
import { activateWeeklyPlan } from '@/academy/weekly-payments'
import { accountBenefits } from '@/lib/account-reminders'
import { currentUser } from '@/lib/auth'
import { paymentsMode, stripeFor } from '@/lib/stripe-accounts'
import { AcademyBackdrop } from '@/components/AcademyBackdrop'
import type { AcademyCoach } from '@/payload-types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Booked', robots: { index: false } }

export default async function BookedPage({ searchParams }: { searchParams: Promise<{ ref?: string; session_id?: string; simulated?: string }> }) {
  const { ref, session_id, simulated } = await searchParams
  const p = await payload()
  let booking = ref ? (await p.find({ pagination: false, collection: 'academy-bookings', where: { reference: { equals: ref } }, limit: 1, depth: 1, overrideAccess: true })).docs[0] : undefined

  // Confirm here too, in case the Stripe webhook is a few seconds behind
  if (booking && booking.status === 'held') {
    try {
      const mode = paymentsMode('academy')
      const checkout = mode === 'stripe' && session_id ? await stripeFor('academy').checkout.sessions.retrieve(session_id) : null
      const paid = (mode === 'simulate' && Boolean(simulated)) || (checkout?.payment_status === 'paid' && checkout.metadata?.reference === booking.reference)
      if (paid) {
        await confirmAcademyBooking(p, booking.reference)
        if (checkout) await activateWeeklyPlan(p, booking.reference, checkout.id)
        booking = (await p.find({ pagination: false, collection: 'academy-bookings', where: { reference: { equals: booking.reference } }, limit: 1, depth: 1, overrideAccess: true })).docs[0]
      }
    } catch (e) {
      p.logger.error(e)
    }
  }
  const confirmed = booking?.status === 'confirmed'
  const account = booking?.account && typeof booking.account === 'object' ? booking.account : null
  const viewer = await currentUser()
  const coach = booking?.coach as AcademyCoach | undefined
  const sessions = booking
    ? (await p.find({ pagination: false, collection: 'academy-sessions', where: { booking: { equals: booking.id } }, sort: 'startsAt', limit: 60, depth: 0, overrideAccess: true })).docs
    : []
  const covered = sessions.filter((x) => x.needsCover)
  const termPlace = booking?.term && typeof booking.term === 'object' ? booking.term.location : null

  return (
    <div data-brand="academy" data-page-brand="academy" className="relative overflow-hidden">
      <AcademyBackdrop />
      <div className="container-x relative max-w-2xl py-20 text-center">
        {!booking ? (
          <p className="text-muted">We couldn’t find that booking. If you were charged, please contact the Academy.</p>
        ) : (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center bg-white text-2xl text-black">✓</div>
            <h1 className="mt-6 font-display text-4xl font-semibold uppercase">{confirmed ? (booking.kind === 'group' ? `${booking.player.firstName}’s small group place is paid` : booking.type === 'term' ? 'Your term is booked' : booking.packSize ? 'Your holiday pack is booked' : 'You’re booked in') : 'Payment processing'}</h1>
            <p className="mt-2 text-sm text-muted">Reference <span className="font-mono text-ink">{booking.reference}</span></p>
            <dl className="panel mt-8 space-y-3 border border-line p-6 text-left text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted">Coach</dt><dd className="font-medium">{coach?.displayName}</dd></div>
              {booking.type === 'term' && sessions.length > 0 ? (
                <>
                  <div className="flex justify-between gap-4"><dt className="text-muted">Weekly</dt><dd className="text-right font-medium">{booking.weekday}s · {formatDate(sessions[0].startsAt, { hour: 'numeric', minute: '2-digit' })}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-muted">Sessions</dt><dd className="text-right font-medium">{sessions.length} · {formatDate(sessions[0].startsAt, { day: 'numeric', month: 'short' })} – {formatDate(sessions.at(-1)!.startsAt, { day: 'numeric', month: 'short' })}</dd></div>
                </>
              ) : booking.packSize && sessions.length > 0 ? (
                <div className="flex justify-between gap-4"><dt className="text-muted">Holiday pack · {sessions.length} sessions</dt><dd className="text-right font-medium">{sessions.map((x) => <span key={x.startsAt} className="block">{formatDate(x.startsAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>)}</dd></div>
              ) : (
                <div className="flex justify-between gap-4"><dt className="text-muted">When</dt><dd className="text-right font-medium">{booking.firstSessionAt ? formatDate(booking.firstSessionAt, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }) : ''}</dd></div>
              )}
              <div className="flex justify-between gap-4"><dt className="text-muted">Player</dt><dd className="font-medium">{booking.player.firstName}</dd></div>
              {booking.kind === 'group' && <div className="flex justify-between gap-4"><dt className="text-muted">Group</dt><dd className="text-right font-medium">Small group{booking.groupSize ? ` of ${booking.groupSize}` : ''} — each family pays for their own player</dd></div>}
              {booking.paymentMode === 'weekly' ? (
                <>
                  <div className="flex justify-between gap-4"><dt className="text-muted">Paid today</dt><dd className="font-medium">{formatAUD(booking.amount / (booking.sessionsTotal || 1))}</dd></div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Then weekly</dt>
                    <dd className="text-right font-medium">
                      {(booking.sessionsTotal ?? 1) - 1} × {formatAUD(booking.amount / (booking.sessionsTotal || 1))}, 2 days before each session
                      {booking.chargeAnchorAt && <span className="block text-xs text-muted">first on {formatDate(booking.chargeAnchorAt, { weekday: 'short', day: 'numeric', month: 'short' })}</span>}
                    </dd>
                  </div>
                </>
              ) : (
                <>
                  {(booking.creditSessionsUsed ?? 0) > 0 && <div className="flex justify-between gap-4"><dt className="text-muted">Session credits used</dt><dd className="font-medium">{booking.creditSessionsUsed}</dd></div>}
                  <div className="flex justify-between gap-4"><dt className="text-muted">Paid</dt><dd className="font-medium">{booking.amount - (booking.creditApplied ?? 0) <= 0 ? 'Nothing — covered by your credit' : formatAUD(booking.amount - (booking.creditApplied ?? 0))}</dd></div>
                </>
              )}
            </dl>
            {covered.length > 0 && (
              <p className="mt-4 border border-white/40 p-4 text-left text-sm">
                {coach?.displayName} is away for {covered.length} session{covered.length === 1 ? '' : 's'} ({covered.map((x) => formatDate(x.startsAt, { day: 'numeric', month: 'short' })).join(', ')}). A replacement coach will be allocated, with a detailed handover so progress continues.
              </p>
            )}
            {confirmed && <BookingNextSteps reference={booking.reference} academy directions={termPlace ? programPlace(termPlace, null).directions : null} />}
            {!confirmed ? (
              <p className="mt-6 text-sm text-muted">Your payment is being confirmed — this page will update shortly. Refresh in a minute.</p>
            ) : account?.activated ? (
              <div className="panel mt-6 border border-line p-5 text-sm">
                <p>This booking is in your account, with all your sessions and payments.</p>
                <Link href={viewer?.id === account.id ? '/account' : '/login?next=/account'} className="mt-3 inline-block font-semibold underline">
                  {viewer?.id === account.id ? 'View my account →' : 'Log in to view →'}
                </Link>
              </div>
            ) : (
              <div className="panel mt-6 border border-line p-5 text-left text-sm">
                <p className="font-semibold">We’ve emailed your confirmation and a link to create your free account.</p>
                <ul className="mt-3 grid gap-1 text-muted sm:grid-cols-2">
                  {accountBenefits.map((b) => <li key={b}>· {b}</li>)}
                </ul>
              </div>
            )}
            <Link href="/academy/1-on-1" className="mt-8 inline-block bg-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-black">Book another session</Link>
          </>
        )}
      </div>
    </div>
  )
}
