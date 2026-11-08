import type Stripe from 'stripe'
import { payload } from '@/lib/payload'
import { cancelPending, confirmPayment } from '@/lib/payments'
import { settleUses } from '@/promotions/service'
import { isPayee, stripeFor, webhookSecretFor } from '@/lib/stripe-accounts'
import { activateWeeklyPlan, recordWeeklyFailed, recordWeeklyPaid, weeklyPlanEnded } from '@/academy/weekly-payments'
import { applySubscription } from '@/academy/pdr/billing/sync'
import { guardTrialCard } from '@/academy/pdr/billing/trial'

/**
 * One endpoint per Stripe account:
 *   https://www.rowvilleeagles.com.au/stripe/webhook/club
 *   https://www.rowvilleeagles.com.au/stripe/webhook/academy
 * Subscribe each to: checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.expired
 * Academy account also (weekly 1-on-1 plans): invoice.paid, invoice.payment_failed, customer.subscription.deleted
 */
export async function POST(req: Request, { params }: { params: Promise<{ payee: string }> }) {
  const { payee } = await params
  if (!isPayee(payee)) return new Response('Unknown account', { status: 404 })

  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('Missing signature', { status: 400 })

  let event: Stripe.Event
  try {
    event = stripeFor(payee).webhooks.constructEvent(await req.text(), signature, webhookSecretFor(payee))
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  const p = await payload()
  if (event.type.startsWith('checkout.session.')) {
    const session = event.data.object as Stripe.Checkout.Session
    const { kind, reference, payee: metaPayee } = session.metadata ?? {}
    if ((kind === 'booking' || kind === 'order' || kind === 'academy') && reference && metaPayee === payee) {
      if ((event.type === 'checkout.session.completed' && session.payment_status === 'paid') || event.type === 'checkout.session.async_payment_succeeded') {
        await confirmPayment(p, kind, reference)
        // Weekly plans: schedule the remaining charges on the saved card (no-op for other bookings)
        if (kind === 'academy') await activateWeeklyPlan(p, reference, session.id)
      } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
        await cancelPending(p, kind, reference)
      }
    }
  }

  // Foundation+ subscriptions (metadata.kind = 'fplus'): keep the player's plan and tag in sync
  if (payee === 'academy' && event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    if (session.mode === 'subscription' && session.metadata?.kind === 'fplus' && session.subscription) {
      const sub = await stripeFor('academy').subscriptions.retrieve(idOf(session.subscription)!, { expand: ['items.data.price'] })
      const blocked = await guardTrialCard(p, sub as never)
      await applySubscription(p, (blocked ? { ...sub, status: 'canceled' } : sub) as never)
      if (session.metadata?.promoRef) await settleUses(p, session.metadata.promoRef, 'paid')
    }
  }
  if (payee === 'academy' && (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted')) {
    const sub = event.data.object as Stripe.Subscription
    if (sub.metadata?.kind === 'fplus') {
      const blocked = await guardTrialCard(p, sub as never)
      await applySubscription(p, (blocked ? { ...sub, status: 'canceled' } : sub) as never)
    }
  }

  if (payee === 'academy' && (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed')) {
    const invoice = event.data.object as Stripe.Invoice
    const sub = invoice.parent?.subscription_details
    // Checkout is a one-off payment, so every subscription invoice is a weekly charge (the first one,
    // when the schedule starts, is 'subscription_create'; later ones 'subscription_cycle').
    if (sub && (invoice.billing_reason === 'subscription_create' || invoice.billing_reason === 'subscription_cycle') && sub.metadata?.kind === 'academy') {
      const charge = {
        reference: sub.metadata.reference,
        subscriptionId: idOf(sub.subscription),
        invoiceId: invoice.id!,
        amount: (event.type === 'invoice.paid' ? invoice.amount_paid : invoice.amount_due) / 100,
        payUrl: invoice.hosted_invoice_url,
        attempt: invoice.attempt_count,
        final: invoice.next_payment_attempt === null,
      }
      const result = event.type === 'invoice.paid' ? await recordWeeklyPaid(p, charge) : await recordWeeklyFailed(p, charge)
      if (!result.ok) p.logger.error(`Weekly charge ${invoice.id} has no matching 1-on-1 booking`)
    }
  }

  if (payee === 'academy' && event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    if (sub.metadata?.kind === 'academy') await weeklyPlanEnded(p, { reference: sub.metadata.reference, subscriptionId: sub.id })
  }

  return Response.json({ received: true })
}

const idOf = (v: string | { id: string } | null | undefined) => (v ? (typeof v === 'string' ? v : v.id) : null)
