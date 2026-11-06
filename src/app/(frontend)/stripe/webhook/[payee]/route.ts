import type Stripe from 'stripe'
import { payload } from '@/lib/payload'
import { cancelPending, confirmPayment } from '@/lib/payments'
import { isPayee, stripeFor, webhookSecretFor } from '@/lib/stripe-accounts'
import { activateWeeklyPlan, recordWeeklyFailed, recordWeeklyPaid, weeklyPlanEnded } from '@/academy/weekly-payments'

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
        if (kind === 'academy' && session.mode === 'subscription' && session.subscription) {
          await activateWeeklyPlan(p, reference, { subscriptionId: idOf(session.subscription)!, customerId: idOf(session.customer) })
        }
      } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
        await cancelPending(p, kind, reference)
      }
    }
  }

  if (payee === 'academy' && (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed')) {
    const invoice = event.data.object as Stripe.Invoice
    const sub = invoice.parent?.subscription_details
    // Today's checkout payment is handled by checkout.session.completed; here we only want the weekly charges
    if (sub && invoice.billing_reason === 'subscription_cycle' && sub.metadata?.kind === 'academy') {
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
