import type Stripe from 'stripe'
import type { AcademyBooking } from '@/payload-types'
import { paymentsMode, stripeFor } from '../lib/stripe-accounts'

/**
 * Refund `amount` AUD of a 1-on-1 booking to the family's card on the Academy Stripe account.
 * Money is taken back from the most recent payments first (weekly charges, then the checkout payment).
 * Each Stripe call uses an idempotency key built from `key`, so retrying a failed refund never refunds twice.
 */
export async function refundToCard(booking: AcademyBooking, amount: number, key: string): Promise<{ status: 'refunded' | 'simulated'; ids: string[] }> {
  let remaining = Math.round(amount * 100)
  if (remaining <= 0) return { status: 'refunded', ids: [] }
  if (paymentsMode('academy') === 'simulate') return { status: 'simulated', ids: [] }

  const stripe = stripeFor('academy')
  const intents: string[] = []
  for (const p of [...(booking.payments ?? [])].reverse()) {
    if (p.status !== 'paid') continue
    const { data } = await stripe.invoicePayments.list({ invoice: p.invoiceId, status: 'paid', limit: 10 })
    for (const ip of data) {
      const pi = ip.payment?.payment_intent
      if (pi) intents.push(typeof pi === 'string' ? pi : pi.id)
    }
  }
  if (booking.stripeCheckoutId) {
    const cs = await stripe.checkout.sessions.retrieve(booking.stripeCheckoutId)
    const pi = cs.payment_intent
    if (pi) intents.push(typeof pi === 'string' ? pi : pi.id)
  }

  const ids: string[] = []
  for (const pi of intents) {
    if (remaining <= 0) break
    const intent = await stripe.paymentIntents.retrieve(pi, { expand: ['latest_charge'] })
    const charge = intent.latest_charge as Stripe.Charge | null
    const available = charge ? charge.amount - charge.amount_refunded : 0
    const take = Math.min(available, remaining)
    if (take <= 0) continue
    const refund = await stripe.refunds.create(
      { payment_intent: pi, amount: take, reason: 'requested_by_customer', metadata: { reference: booking.reference, key } },
      { idempotencyKey: `${key}-${pi}-${take}` },
    )
    ids.push(refund.id)
    remaining -= take
  }
  if (remaining > 0) throw new Error(`Stripe could only refund $${((Math.round(amount * 100) - remaining) / 100).toFixed(2)} of $${amount.toFixed(2)} — the rest has no card payment left to refund.`)
  return { status: 'refunded', ids }
}

/** Stop a weekly plan's future charges. */
export async function stopWeeklyCharges(booking: Pick<AcademyBooking, 'stripeScheduleId' | 'stripeSubscriptionId'>) {
  if (paymentsMode('academy') === 'simulate') return 'simulated'
  const stripe = stripeFor('academy')
  if (booking.stripeScheduleId) {
    const schedule = await stripe.subscriptionSchedules.retrieve(booking.stripeScheduleId)
    if (schedule.status === 'not_started' || schedule.status === 'active') {
      await stripe.subscriptionSchedules.cancel(booking.stripeScheduleId, { prorate: false, invoice_now: false })
      return 'stopped'
    }
  }
  if (booking.stripeSubscriptionId) {
    const sub = await stripe.subscriptions.retrieve(booking.stripeSubscriptionId)
    if (sub.status !== 'canceled') await stripe.subscriptions.cancel(booking.stripeSubscriptionId, { prorate: false, invoice_now: false })
    return 'stopped'
  }
  return 'none'
}
