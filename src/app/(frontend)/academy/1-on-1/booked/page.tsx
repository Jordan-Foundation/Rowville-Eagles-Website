import Link from 'next/link'
import type { Metadata } from 'next'
import { payload, formatAUD, formatDate } from '@/lib/payload'
import { confirmAcademyBooking } from '@/academy/booking-data'
import { paymentsMode, stripeFor } from '@/lib/stripe-accounts'
import { AcademyBackdrop } from '@/components/AcademyBackdrop'
import type { AcademyCoach } from '@/payload-types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Booked', robots: { index: false } }

export default async function BookedPage({ searchParams }: { searchParams: Promise<{ ref?: string; session_id?: string; simulated?: string }> }) {
  const { ref, session_id, simulated } = await searchParams
  const p = await payload()
  let booking = ref ? (await p.find({ collection: 'academy-bookings', where: { reference: { equals: ref } }, limit: 1, depth: 1, overrideAccess: true })).docs[0] : undefined

  // Confirm here too, in case the Stripe webhook is a few seconds behind
  if (booking && booking.status === 'held') {
    try {
      const mode = paymentsMode('academy')
      const paid =
        (mode === 'simulate' && Boolean(simulated)) ||
        (mode === 'stripe' && Boolean(session_id) && (await stripeFor('academy').checkout.sessions.retrieve(session_id!)).payment_status === 'paid')
      if (paid) {
        await confirmAcademyBooking(p, booking.reference)
        booking = (await p.find({ collection: 'academy-bookings', where: { reference: { equals: booking.reference } }, limit: 1, depth: 1, overrideAccess: true })).docs[0]
      }
    } catch (e) {
      p.logger.error(e)
    }
  }
  const confirmed = booking?.status === 'confirmed'
  const coach = booking?.coach as AcademyCoach | undefined
  const sessions = booking
    ? (await p.find({ collection: 'academy-sessions', where: { booking: { equals: booking.id } }, sort: 'startsAt', limit: 60, depth: 0, overrideAccess: true })).docs
    : []
  const covered = sessions.filter((x) => x.needsCover)

  return (
    <div data-brand="academy" data-page-brand="academy" className="relative overflow-hidden">
      <AcademyBackdrop />
      <div className="container-x relative max-w-2xl py-20 text-center">
        {!booking ? (
          <p className="text-muted">We couldn’t find that booking. If you were charged, please contact the Academy.</p>
        ) : (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center bg-white text-2xl text-black">✓</div>
            <h1 className="mt-6 font-display text-4xl font-semibold uppercase">{confirmed ? (booking.type === 'term' ? 'Your term is booked' : 'You’re booked in') : 'Payment processing'}</h1>
            <p className="mt-2 text-sm text-muted">Reference <span className="font-mono text-ink">{booking.reference}</span></p>
            <dl className="panel mt-8 space-y-3 border border-line p-6 text-left text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted">Coach</dt><dd className="font-medium">{coach?.displayName}</dd></div>
              {booking.type === 'term' && sessions.length > 0 ? (
                <>
                  <div className="flex justify-between gap-4"><dt className="text-muted">Weekly</dt><dd className="text-right font-medium">{booking.weekday}s · {formatDate(sessions[0].startsAt, { hour: 'numeric', minute: '2-digit' })}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-muted">Sessions</dt><dd className="text-right font-medium">{sessions.length} · {formatDate(sessions[0].startsAt, { day: 'numeric', month: 'short' })} – {formatDate(sessions.at(-1)!.startsAt, { day: 'numeric', month: 'short' })}</dd></div>
                </>
              ) : (
                <div className="flex justify-between gap-4"><dt className="text-muted">When</dt><dd className="text-right font-medium">{booking.firstSessionAt ? formatDate(booking.firstSessionAt, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }) : ''}</dd></div>
              )}
              <div className="flex justify-between gap-4"><dt className="text-muted">Player</dt><dd className="font-medium">{booking.player.firstName}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Paid</dt><dd className="font-medium">{formatAUD(booking.amount)}</dd></div>
            </dl>
            {covered.length > 0 && (
              <p className="mt-4 border border-white/40 p-4 text-left text-sm">
                {coach?.displayName} is away for {covered.length} session{covered.length === 1 ? '' : 's'} ({covered.map((x) => formatDate(x.startsAt, { day: 'numeric', month: 'short' })).join(', ')}). A replacement coach will be allocated, with a detailed handover so progress continues.
              </p>
            )}
            <p className="mt-6 text-sm text-muted">
              {confirmed ? 'We’ve emailed your confirmation, with a link to create your free account and see all your sessions in one place.' : 'Your payment is being confirmed — this page will update shortly. Refresh in a minute.'}
            </p>
            <Link href="/academy/1-on-1" className="mt-8 inline-block bg-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-black">Book another session</Link>
          </>
        )}
      </div>
    </div>
  )
}
