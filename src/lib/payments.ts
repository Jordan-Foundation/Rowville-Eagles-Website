import type { Payload } from 'payload'
import { paymentsMode, stripeAccounts, stripeFor, type Payee } from './stripe-accounts'
import { onBookingPaid, onOrderPaid } from './notifications'
import { makeReference } from './reference'
import { confirmAcademyBooking, releaseAcademyHold } from '../academy/booking-data'
import { settleUses } from '../promotions/service'

export const siteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')

/** Human-friendly unique reference, e.g. RFA-7K3QX9 */
export const newReference = (payee: Payee) => makeReference(stripeAccounts[payee].refPrefix)

const toCents = (aud: number) => Math.round(aud * 100)

type LineItem = { name: string; description?: string; unitAmount: number; quantity: number }

/** Creates a Stripe Checkout Session on the right account and returns the URL to redirect to. */
export type CheckoutKind = 'booking' | 'order' | 'academy'

export async function startCheckout(opts: {
  payee: Payee
  kind: CheckoutKind
  reference: string
  email: string
  items: LineItem[]
  cancelPath: string
  /** Page to return to after paying (default /checkout/success) */
  successPath?: string
  /** Minutes the Stripe checkout link stays open (Stripe minimum 30) */
  expiresInMinutes?: number
  /**
   * Weekly plan: charge `items` today as a normal payment and save the card for later charges.
   * The weekly charges themselves are scheduled after payment (see academy/weekly-payments.ts) —
   * so Stripe's checkout never shows a subscription or "free trial". `note` is shown above the pay button.
   */
  saveCardFor?: { note: string }
  /** Promotion discount already worked out on the server: shown in Stripe as its own line (e.g. "Winter special — 20% off"). */
  discount?: { amount: number; label: string } | null
}): Promise<{ url: string; sessionId?: string; simulated: boolean }> {
  const success = `${siteUrl()}${opts.successPath ?? '/checkout/success'}?kind=${opts.kind}&ref=${opts.reference}`

  if (paymentsMode(opts.payee) === 'simulate') {
    return { url: `${success}&simulated=1`, simulated: true }
  }

  const metadata = { kind: opts.kind, reference: opts.reference, payee: opts.payee }
  const description = `${opts.reference} — ${opts.items.map((i) => i.name).join(', ')}`
  const lineItems = opts.items.map((i) => ({
    quantity: i.quantity,
    price_data: {
      currency: 'aud',
      unit_amount: toCents(i.unitAmount),
      product_data: { name: i.name, ...(i.description ? { description: i.description } : {}) },
    },
  }))
  const save = opts.saveCardFor
  const stripe = stripeFor(opts.payee)
  // A single-use coupon for exactly this discount (Stripe then shows it as a discount line and charges the rest)
  const coupon = opts.discount && opts.discount.amount > 0
    ? await stripe.coupons.create({ amount_off: toCents(opts.discount.amount), currency: 'aud', duration: 'once', max_redemptions: 1, name: opts.discount.label.slice(0, 40) })
    : null
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: opts.email,
    metadata,
    line_items: lineItems,
    ...(coupon ? { discounts: [{ coupon: coupon.id }] } : {}),
    payment_intent_data: { metadata, description, ...(save ? { setup_future_usage: 'off_session' as const } : {}) },
    ...(save ? { customer_creation: 'always' as const, custom_text: { submit: { message: save.note } } } : {}),
    success_url: `${success}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}${opts.cancelPath}`,
    expires_at: Math.floor(Date.now() / 1000) + Math.max(30, opts.expiresInMinutes ?? 30) * 60,
  })
  if (!session.url) throw new Error('Stripe did not return a checkout URL')
  return { url: session.url, sessionId: session.id, simulated: false }
}

/** Idempotently confirm payment for a booking or order (called by webhook, success page and simulate mode). */
export async function confirmPayment(payload: Payload, kind: CheckoutKind, reference: string) {
  const result = await confirmPaymentInner(payload, kind, reference)
  if (['paid', 'confirmed', 'completed'].includes((result as { status?: string } | undefined)?.status ?? '')) await settleUses(payload, reference, 'paid')
  return result
}

async function confirmPaymentInner(payload: Payload, kind: CheckoutKind, reference: string) {
  if (kind === 'academy') return confirmAcademyBooking(payload, reference)
  if (kind === 'booking') {
    const { docs } = await payload.find({ collection: 'bookings', where: { reference: { equals: reference } }, limit: 1, depth: 0 })
    const b = docs[0]
    if (!b || b.status !== 'pending') return b
    const paid = await payload.update({ collection: 'bookings', id: b.id, data: { status: 'paid' } })
    try {
      await onBookingPaid(payload, paid)
    } catch (e) {
      payload.logger.error({ err: e, msg: `Post-payment steps failed for ${reference}` })
    }
    return paid
  }

  const { docs } = await payload.find({ collection: 'orders', where: { reference: { equals: reference } }, limit: 1, depth: 0 })
  const o = docs[0]
  if (!o || o.status !== 'pending') return o
  // Decrement tracked stock
  for (const item of o.items ?? []) {
    const productId = typeof item.product === 'object' ? item.product?.id : item.product
    if (!productId) continue
    const product = await payload.findByID({ collection: 'products', id: productId, depth: 0 })
    const variants = (product.variants ?? []).map((v) =>
      v.size === item.size && typeof v.stock === 'number' ? { ...v, stock: Math.max(0, v.stock - (item.quantity ?? 0)) } : v,
    )
    await payload.update({ collection: 'products', id: productId, data: { variants } })
  }
  const paidOrder = await payload.update({ collection: 'orders', id: o.id, data: { status: 'paid' } })
  try {
    await onOrderPaid(payload, paidOrder)
  } catch (e) {
    payload.logger.error({ err: e, msg: `Order email failed for ${reference}` })
  }
  return paidOrder
}

/** Release an unpaid booking/order when its Stripe session expires. */
export async function cancelPending(payload: Payload, kind: CheckoutKind, reference: string) {
  await settleUses(payload, reference, 'cancelled')
  if (kind === 'academy') return releaseAcademyHold(payload, reference)
  const collection = kind === 'booking' ? 'bookings' : 'orders'
  const { docs } = await payload.find({ collection, where: { reference: { equals: reference } }, limit: 1, depth: 0 })
  const doc = docs[0]
  if (doc?.status === 'pending') await payload.update({ collection, id: doc.id, data: { status: 'cancelled' } })
}

/** Places taken: paid + pending bookings still inside their 35-minute checkout window. */
export async function placesTaken(
  payload: Payload,
  programId: number | string,
  sessionStart?: string,
  filter: { bookingType?: 'enrolment' | 'trial'; birthYear?: number } = {},
) {
  const holdCutoff = new Date(Date.now() - 35 * 60 * 1000).toISOString()
  const { totalDocs } = await payload.count({
    collection: 'bookings',
    where: {
      and: [
        { program: { equals: programId } },
        ...(sessionStart ? [{ sessionStart: { equals: sessionStart } }] : []),
        ...(filter.bookingType === 'trial' ? [{ bookingType: { equals: 'trial' } }] : []),
        ...(filter.bookingType === 'enrolment' ? [{ bookingType: { not_equals: 'trial' } }] : []),
        ...(filter.birthYear ? [{ birthYear: { equals: filter.birthYear } }] : []),
        { or: [{ status: { equals: 'paid' } }, { and: [{ status: { equals: 'pending' } }, { createdAt: { greater_than: holdCutoff } }] }] },
      ],
    },
  })
  return totalDocs
}
