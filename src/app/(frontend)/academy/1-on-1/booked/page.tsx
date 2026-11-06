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

  return (
    <div data-brand="academy" data-page-brand="academy" className="relative overflow-hidden">
      <AcademyBackdrop />
      <div className="container-x relative max-w-2xl py-20 text-center">
        {!booking ? (
          <p className="text-muted">We couldn’t find that booking. If you were charged, please contact the Academy.</p>
        ) : (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center bg-white text-2xl text-black">✓</div>
            <h1 className="mt-6 font-display text-4xl font-semibold uppercase">{confirmed ? 'You’re booked in' : 'Payment processing'}</h1>
            <p className="mt-2 text-sm text-muted">Reference <span className="font-mono text-ink">{booking.reference}</span></p>
            <dl className="panel mt-8 space-y-3 border border-line p-6 text-left text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted">Coach</dt><dd className="font-medium">{coach?.displayName}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">When</dt><dd className="text-right font-medium">{booking.firstSessionAt ? formatDate(booking.firstSessionAt, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }) : ''}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Player</dt><dd className="font-medium">{booking.player.firstName}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Paid</dt><dd className="font-medium">{formatAUD(booking.amount)}</dd></div>
            </dl>
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
