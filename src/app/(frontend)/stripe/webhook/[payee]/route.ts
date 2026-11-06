import type Stripe from 'stripe'
import { payload } from '@/lib/payload'
import { cancelPending, confirmPayment } from '@/lib/payments'
import { isPayee, stripeFor, webhookSecretFor } from '@/lib/stripe-accounts'

/**
 * One endpoint per Stripe account:
 *   https://www.rowvilleeagles.com.au/stripe/webhook/club
 *   https://www.rowvilleeagles.com.au/stripe/webhook/academy
 * Subscribe each to: checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.expired
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
      } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
        await cancelPending(p, kind, reference)
      }
    }
  }
  return Response.json({ received: true })
}
