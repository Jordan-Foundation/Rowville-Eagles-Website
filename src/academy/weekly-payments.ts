import type { Payload, Where } from 'payload'
import type { AcademyBooking, AcademyCoach } from '@/payload-types'
import { emailLayout, esc } from '../lib/email-templates'
import { sendEmail } from '../lib/email'
import { formatAUD, formatDate } from '../lib/format'
import { siteUrl } from '../lib/payments'
import { paymentsMode, stripeFor } from '../lib/stripe-accounts'
import { academyBrand } from './brand'
import { nextChargeAt } from './weekly'

/**
 * Weekly payment plans: Stripe events → booking state.
 * Every function here is idempotent — Stripe can deliver the same event more than once.
 */

const relId = (v: number | { id: number } | null | undefined) => (v && typeof v === 'object' ? v.id : (v ?? undefined))
const when = (iso: string) => formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

async function findWeekly(payload: Payload, ref: { reference?: string | null; subscriptionId?: string | null }) {
  const or: Where[] = [
    ...(ref.reference ? [{ reference: { equals: ref.reference } }] : []),
    ...(ref.subscriptionId ? [{ stripeSubscriptionId: { equals: ref.subscriptionId } }] : []),
  ]
  if (!or.length) return undefined
  const { docs } = await payload.find({ collection: 'academy-bookings', where: { or, paymentMode: { equals: 'weekly' } }, limit: 1, depth: 0, overrideAccess: true })
  return docs[0]
}

const planOf = (b: AcademyBooking) =>
  b.chargeAnchorAt ? { anchor: Math.floor(new Date(b.chargeAnchorAt).getTime() / 1000), recurringCharges: (b.sessionsTotal ?? 1) - 1 } : null

/** Mark the first `paid` live sessions as paid and the rest unpaid. */
export async function syncPaidSessions(payload: Payload, booking: Pick<AcademyBooking, 'id'>, paid: number) {
  const { docs } = await payload.find({
    collection: 'academy-sessions',
    where: { booking: { equals: booking.id }, status: { not_equals: 'cancelled' } },
    sort: 'startsAt',
    limit: 60,
    depth: 0,
    overrideAccess: true,
  })
  for (const [i, s] of docs.entries()) {
    const should = i < paid
    if (Boolean(s.paid) !== should) await payload.update({ collection: 'academy-sessions', id: s.id, data: { paid: should }, overrideAccess: true })
  }
}

/** How many sessions are covered: today's checkout payment plus each paid automatic charge. */
const paidCount = (b: AcademyBooking) => Math.min(b.sessionsTotal ?? 1, 1 + (b.payments ?? []).filter((x) => x.status === 'paid').length)

/**
 * Today's payment went through for a weekly plan: schedule the remaining weekly charges on the
 * card the family just used. A Stripe subscription schedule starts at the session-2 charge, bills
 * weekly, and ends (cancels) by itself after the final charge — no trial, nothing shown at checkout.
 *
 * Called from both the webhook and the success page, so it may run twice at once: Stripe
 * idempotency keys make the second call return the same price and schedule instead of a duplicate.
 */
export async function activateWeeklyPlan(payload: Payload, reference: string, checkoutSessionId: string) {
  const booking = await findWeekly(payload, { reference })
  if (!booking || booking.stripeScheduleId || paymentsMode('academy') !== 'stripe') return booking
  if (booking.status !== 'confirmed' && booking.status !== 'payment_failed') return booking
  const plan = planOf(booking)
  if (!plan || plan.recurringCharges < 1) return booking

  const stripe = stripeFor('academy')
  const checkout = await stripe.checkout.sessions.retrieve(checkoutSessionId, { expand: ['payment_intent'] })
  if (checkout.metadata?.reference !== reference) throw new Error(`Checkout ${checkoutSessionId} is not for ${reference}`)
  const customer = typeof checkout.customer === 'string' ? checkout.customer : checkout.customer?.id
  const intent = checkout.payment_intent && typeof checkout.payment_intent === 'object' ? checkout.payment_intent : null
  const paymentMethod = intent && (typeof intent.payment_method === 'string' ? intent.payment_method : intent.payment_method?.id)
  if (!customer || !paymentMethod) throw new Error(`No saved card on checkout ${checkoutSessionId} for ${reference}`)

  const coach = await payload.findByID({ collection: 'academy-coaches', id: relId(booking.coach)!, depth: 0, overrideAccess: true })
  const perSession = Math.round((booking.amount / (booking.sessionsTotal || 1)) * 100)
  const metadata = { kind: 'academy', reference, payee: 'academy' }
  const price = await stripe.prices.create(
    {
      currency: 'aud',
      unit_amount: perSession,
      recurring: { interval: 'week' },
      product_data: { name: `Weekly 1-on-1 with ${coach.displayName}` },
      metadata,
    },
    { idempotencyKey: `weekly-price-${reference}` },
  )
  const schedule = await stripe.subscriptionSchedules.create(
    {
      customer,
      start_date: plan.anchor,
      end_behavior: 'cancel',
      metadata,
      phases: [
        {
          items: [{ price: price.id, quantity: 1 }],
          end_date: plan.anchor + plan.recurringCharges * 7 * 86400,
          default_payment_method: paymentMethod,
          description: `${reference} — ${booking.player.firstName} ${booking.player.lastName}, weekly 1-on-1s with ${coach.displayName}`,
          metadata,
        },
      ],
    },
    { idempotencyKey: `weekly-schedule-${reference}` },
  )
  return payload.update({
    collection: 'academy-bookings',
    id: booking.id,
    data: { stripeScheduleId: schedule.id, stripeCustomerId: customer },
    overrideAccess: true,
  })
}

type Charge = {
  reference?: string | null
  subscriptionId?: string | null
  invoiceId: string
  /** AUD */
  amount: number
  payUrl?: string | null
  /** Stripe's attempt counter (1 = first try) */
  attempt?: number
  /** No more automatic retries are scheduled */
  final?: boolean
}

/** An automatic weekly charge succeeded (`invoice.paid`, billing reason subscription_cycle). */
export async function recordWeeklyPaid(payload: Payload, c: Charge) {
  const booking = await findWeekly(payload, c)
  if (!booking) return { ok: false as const, reason: 'no-booking' }
  const payments = [...(booking.payments ?? [])]
  const existing = payments.find((x) => x.invoiceId === c.invoiceId)
  if (existing?.status === 'paid') return { ok: true as const, booking, duplicate: true }
  const recovered = existing?.status === 'failed'
  if (existing) Object.assign(existing, { status: 'paid', amount: c.amount, at: new Date().toISOString(), payUrl: null })
  else payments.push({ invoiceId: c.invoiceId, status: 'paid', amount: c.amount, at: new Date().toISOString() })

  const draft = { ...booking, payments }
  const paid = paidCount(draft)
  const stillFailing = payments.some((x) => x.status === 'failed')
  const plan = planOf(booking)
  const updated = await payload.update({
    collection: 'academy-bookings',
    id: booking.id,
    data: {
      payments,
      sessionsPaid: paid,
      ...(c.subscriptionId && !booking.stripeSubscriptionId ? { stripeSubscriptionId: c.subscriptionId } : {}),
      nextChargeAt: plan ? nextChargeAt(plan, paid) : null,
      ...(booking.status === 'payment_failed' && !stillFailing ? { status: 'confirmed' as const } : {}),
    },
    overrideAccess: true,
  })
  await syncPaidSessions(payload, booking, paid)
  if (recovered && !stillFailing) await notifyRecovered(payload, updated)
  return { ok: true as const, booking: updated }
}

/** An automatic weekly charge failed (`invoice.payment_failed`). Stripe retries it automatically. */
export async function recordWeeklyFailed(payload: Payload, c: Charge) {
  const booking = await findWeekly(payload, c)
  if (!booking) return { ok: false as const, reason: 'no-booking' }
  if (booking.status === 'cancelled' || booking.status === 'refunded') return { ok: true as const, booking }
  const payments = [...(booking.payments ?? [])]
  const existing = payments.find((x) => x.invoiceId === c.invoiceId)
  if (existing?.status === 'paid') return { ok: true as const, booking }
  const first = !existing
  if (existing) Object.assign(existing, { payUrl: c.payUrl ?? existing.payUrl, at: new Date().toISOString() })
  else payments.push({ invoiceId: c.invoiceId, status: 'failed', amount: c.amount, at: new Date().toISOString(), payUrl: c.payUrl ?? undefined })

  const updated = await payload.update({ collection: 'academy-bookings', id: booking.id, data: { payments, status: 'payment_failed', ...(c.subscriptionId && !booking.stripeSubscriptionId ? { stripeSubscriptionId: c.subscriptionId } : {}) }, overrideAccess: true })
  // Email the family on the first failure and again when Stripe gives up; the admin hears about both.
  if (first || c.final) await notifyFailed(payload, updated, { payUrl: c.payUrl, final: Boolean(c.final), amount: c.amount })
  return { ok: true as const, booking: updated }
}

/** The Stripe subscription ended (`customer.subscription.deleted`). Normal at the end of term. */
export async function weeklyPlanEnded(payload: Payload, ref: { reference?: string | null; subscriptionId: string }) {
  const booking = await findWeekly(payload, ref)
  if (!booking) return
  const paid = paidCount(booking)
  await payload.update({ collection: 'academy-bookings', id: booking.id, data: { nextChargeAt: null }, overrideAccess: true })
  if (paid < (booking.sessionsTotal ?? 0) && booking.status !== 'cancelled' && booking.status !== 'refunded') {
    await alertAdmin(payload, booking, {
      subject: `Weekly plan ended early: ${booking.reference}`,
      heading: 'A weekly payment plan stopped early',
      intro: `Stripe ended the weekly plan for ${esc(booking.player.firstName)} ${esc(booking.player.lastName)} with ${paid} of ${booking.sessionsTotal} sessions paid. The remaining sessions are still booked — please contact the family to arrange payment, or cancel the remaining sessions.`,
    })
  }
}

// ── Emails ───────────────────────────────────────────────────────────────────

async function context(payload: Payload, booking: AcademyBooking) {
  const coach = (await payload.findByID({ collection: 'academy-coaches', id: relId(booking.coach)!, depth: 0, overrideAccess: true })) as AcademyCoach
  const { docs: sessions } = await payload.find({
    collection: 'academy-sessions',
    where: { booking: { equals: booking.id }, status: { equals: 'scheduled' }, paid: { not_equals: true } },
    sort: 'startsAt',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return { coach, nextUnpaid: sessions[0] }
}

async function notifyFailed(payload: Payload, booking: AcademyBooking, f: { payUrl?: string | null; final: boolean; amount: number }) {
  const { coach, nextUnpaid } = await context(payload, booking)
  const rows: [string, string][] = [
    ['Amount', formatAUD(f.amount)],
    ['Player', `${booking.player.firstName} ${booking.player.lastName}`],
    ['Coach', coach.displayName],
    ...(nextUnpaid ? ([['Next session', when(nextUnpaid.startsAt)]] as [string, string][]) : []),
    ['Paid so far', `${booking.sessionsPaid ?? 0} of ${booking.sessionsTotal} sessions`],
    ['Reference', booking.reference],
  ]
  const html = emailLayout('academy', [
    {
      heading: f.final ? 'Payment still needed' : 'We couldn’t take this week’s payment',
      intro: f.final
        ? `Hi ${esc(booking.contact.firstName)}, we’ve tried several times but couldn’t take this week’s ${formatAUD(f.amount)} for ${esc(booking.player.firstName)}’s 1-on-1s. Please pay using the button below so ${esc(booking.player.firstName)} keeps their weekly time with ${esc(coach.displayName)}.`
        : `Hi ${esc(booking.contact.firstName)}, the automatic ${formatAUD(f.amount)} payment for ${esc(booking.player.firstName)}’s 1-on-1s with ${esc(coach.displayName)} didn’t go through. We’ll try again automatically over the next few days — or you can pay now, or use a different card, with the button below.`,
      rows,
      ...(f.payUrl ? { cta: { label: 'Pay now', href: f.payUrl } } : {}),
      after: 'Questions? Just reply to this email or call us on ' + esc(academyBrand.phone) + '.',
    },
  ])
  await sendEmail(payload, {
    to: booking.contact.email,
    subject: f.final ? `Payment needed for ${booking.player.firstName}’s 1-on-1s` : `Payment didn’t go through — ${booking.player.firstName}’s 1-on-1s`,
    html,
    sender: 'academy',
    userId: relId(booking.account),
  })
  await alertAdmin(payload, booking, {
    subject: `${f.final ? 'Final retry failed' : 'Weekly payment failed'}: ${booking.reference}`,
    heading: f.final ? 'Weekly payment — all retries failed' : 'Weekly payment failed',
    intro: `${formatAUD(f.amount)} for ${esc(booking.player.firstName)} ${esc(booking.player.lastName)} (${esc(coach.displayName)}) didn’t go through.${f.final ? ' Stripe has stopped retrying — please contact the family.' : ' Stripe will retry automatically and the family has been emailed a link to pay.'}`,
    rows,
  })
}

async function notifyRecovered(payload: Payload, booking: AcademyBooking) {
  const { coach } = await context(payload, booking)
  const html = emailLayout('academy', [
    {
      heading: 'Payment received — thank you',
      intro: `Hi ${esc(booking.contact.firstName)}, the weekly payment for ${esc(booking.player.firstName)}’s 1-on-1s with ${esc(coach.displayName)} has now gone through. You’re all up to date.`,
      rows: [
        ['Paid so far', `${booking.sessionsPaid} of ${booking.sessionsTotal} sessions`],
        ...(booking.nextChargeAt ? ([['Next payment', when(booking.nextChargeAt)]] as [string, string][]) : []),
        ['Reference', booking.reference],
      ],
    },
  ])
  await sendEmail(payload, { to: booking.contact.email, subject: `Payment received — ${booking.player.firstName}’s 1-on-1s`, html, sender: 'academy', userId: relId(booking.account) })
}

async function alertAdmin(payload: Payload, booking: AcademyBooking, a: { subject: string; heading: string; intro: string; rows?: [string, string][] }) {
  const html = emailLayout('academy', [
    { heading: a.heading, intro: a.intro, rows: a.rows ?? [['Reference', booking.reference]], cta: { label: 'Open weekly payments', href: `${siteUrl()}/staff/academy#payments` } },
  ])
  await sendEmail(payload, { to: academyBrand.email, subject: a.subject, html, sender: 'academy' })
}
