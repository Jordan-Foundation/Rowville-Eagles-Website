import { randomBytes } from 'crypto'
import type { Payload } from 'payload'
import { commitTransaction, createLocalReq, initTransaction, killTransaction } from 'payload'
import type { AcademyBooking, AcademyCoach, AcademySession } from '@/payload-types'
import { emailLayout, esc } from '../lib/email-templates'
import { sendEmail } from '../lib/email'
import { formatAUD, formatDate } from '../lib/format'
import { siteUrl } from '../lib/payments'
import { academyBrand } from './brand'
import { quoteCancellation, splitReturn, type CancelBy, type Outcome, type Quote } from './cancellation'
import { giveCredit } from './credits'
import { refundToCard, stopWeeklyCharges } from './refunds'

/**
 * Staff-run cancellations: applies the policy (./cancellation.ts), cancels the sessions, books any make-up,
 * gives credit, refunds the card on Stripe, stops weekly charges, records everything on the booking and
 * emails the family and coach. Refunds run after the database is updated and can be retried safely.
 */

const rel = (v: number | { id: number } | null | undefined) => (v && typeof v === 'object' ? v.id : (v ?? undefined))
const round = (n: number) => Math.round(n * 100) / 100
const day = (iso: string) => formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short' })
const when = (iso: string) => formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export async function loadForCancellation(payload: Payload, bookingId: number) {
  const booking = await payload.findByID({ collection: 'academy-bookings', id: bookingId, depth: 0, overrideAccess: true, disableErrors: true })
  if (!booking) return null
  const [{ docs: sessions }, term] = await Promise.all([
    payload.find({ collection: 'academy-sessions', where: { booking: { equals: bookingId } }, sort: 'startsAt', limit: 100, depth: 0, overrideAccess: true }),
    payload.findByID({ collection: 'academy-terms', id: rel(booking.term)!, depth: 0, overrideAccess: true }),
  ])
  return { booking, sessions, term }
}

export function quoteFor(data: NonNullable<Awaited<ReturnType<typeof loadForCancellation>>>, cancel: 'booking' | number[], by: CancelBy, now = new Date()): Quote {
  return quoteCancellation({
    booking: { ...data.booking, sessionsTotal: data.booking.sessionsTotal ?? 1 },
    sessions: data.sessions.filter((s) => s.status !== 'cancelled'),
    cancel,
    by,
    now,
    cutoffHours: data.term.bookingCutoffHours ?? 24,
  })
}

export type CancelRequest = {
  bookingId: number
  cancel: 'booking' | number[]
  by: CancelBy
  outcome: Outcome
  /** Staff override of the policy amount (goodwill). Requires a reason. */
  overrideAmount?: number
  reason: string
  actorId: number
  /** Make-up: the new time for the (single) cancelled session */
  makeUp?: { startsAt: string; coachId: number }
  notify?: boolean
}

export type CancelResult = { ok: true; key: string; cash: number; credit: number; refund: string; quote: Quote; warnings: string[] } | { ok: false; error: string }

export async function cancelAcademy(payload: Payload, r: CancelRequest): Promise<CancelResult> {
  const data = await loadForCancellation(payload, r.bookingId)
  if (!data) return { ok: false, error: 'Booking not found.' }
  const { booking, sessions } = data
  if (!['confirmed', 'payment_failed', 'completed'].includes(booking.status)) return { ok: false, error: `This booking is ${booking.status} — nothing to cancel.` }
  const quote = quoteFor(data, r.cancel, r.by)
  if (!quote.sessionIds.length) return { ok: false, error: quote.warnings[0] ?? 'No upcoming sessions selected.' }
  if (!r.reason.trim()) return { ok: false, error: 'Please give a reason — it’s kept on the booking.' }

  // Amount and outcome
  const override = r.overrideAmount !== undefined && !Number.isNaN(r.overrideAmount) && r.overrideAmount !== quote.value
  const ceiling = Math.max(quote.value, quote.maxReturn)
  if (override && (r.overrideAmount! < 0 || r.overrideAmount! > ceiling)) return { ok: false, error: `The amount must be between $0 and ${formatAUD(ceiling)}.` }
  if (!override && !quote.options.includes(r.outcome)) return { ok: false, error: `That outcome isn’t available under the policy (${quote.options.join(', ')}). Enter an amount to override it.` }
  if (r.outcome === 'makeup') {
    if (quote.sessionIds.length !== 1) return { ok: false, error: 'Book make-ups one session at a time.' }
    if (!r.makeUp || Number.isNaN(Date.parse(r.makeUp.startsAt)) || new Date(r.makeUp.startsAt) <= new Date()) return { ok: false, error: 'Choose a future date and time for the make-up session.' }
  }
  const amount = r.outcome === 'refund' || r.outcome === 'credit' ? round(override ? r.overrideAmount! : quote.value) : 0
  let { cash, credit } = splitReturn(amount, r.outcome, quote.refundableCash)
  const accountId = rel(booking.account)
  if (credit > 0 && !accountId) {
    if (quote.refundableCash - cash <= 0) return { ok: false, error: 'This family has no account to hold credit — refund to card instead.' }
    cash = round(cash + credit)
    credit = 0
  }

  const key = randomBytes(6).toString('hex')
  const targets = sessions.filter((s) => quote.sessionIds.includes(s.id))
  const now = new Date().toISOString()
  let makeUpSession: AcademySession | undefined

  const req = await createLocalReq({}, payload)
  await initTransaction(req)
  try {
    for (const s of targets) {
      await payload.update({ collection: 'academy-sessions', id: s.id, overrideAccess: true, req, data: { status: 'cancelled', cancelledBy: r.by, cancelledAt: now, cancelReason: r.reason } })
    }
    if (r.outcome === 'makeup') {
      makeUpSession = await payload.create({
        collection: 'academy-sessions',
        overrideAccess: true,
        req,
        data: { booking: booking.id, coach: r.makeUp!.coachId, startsAt: new Date(r.makeUp!.startsAt).toISOString(), status: 'scheduled', account: accountId, paid: targets[0].paid, makeUpFor: targets[0].id },
      })
    }
    if (credit > 0) await giveCredit(payload, { account: accountId!, amount: credit, reason: r.by === 'coach' ? 'coach_cancellation' : override ? 'goodwill' : 'cancellation', booking: booking.id, note: r.reason, createdBy: r.actorId }, req)

    const live = sessions.filter((s) => s.status !== 'cancelled' && !quote.sessionIds.includes(s.id)).length + (makeUpSession ? 1 : 0)
    const toCome = sessions.filter((s) => (s.status === 'scheduled' || s.status === 'held') && !quote.sessionIds.includes(s.id)).length + (makeUpSession ? 1 : 0)
    const status: AcademyBooking['status'] = live === 0 ? 'cancelled' : toCome === 0 ? 'completed' : booking.status
    await payload.update({
      collection: 'academy-bookings',
      id: booking.id,
      overrideAccess: true,
      req,
      data: {
        status,
        creditedAmount: round((booking.creditedAmount ?? 0) + credit),
        ...(quote.stopWeekly ? { nextChargeAt: null } : {}),
        adjustments: [
          ...(booking.adjustments ?? []),
          {
            key,
            action: r.outcome === 'makeup' ? 'makeup' : r.cancel === 'booking' ? 'cancel_booking' : 'cancel_sessions',
            by: r.by,
            outcome: r.outcome,
            sessions: targets.map((s) => day(s.startsAt)).join(', ') + (makeUpSession ? ` → make-up ${when(makeUpSession.startsAt)}` : ''),
            cash,
            credit,
            refundStatus: cash > 0 ? 'pending' : 'none',
            rule: override ? `${quote.rule} Overridden by staff: ${formatAUD(amount)}.` : quote.rule,
            reason: r.reason,
            actor: r.actorId,
            at: now,
          },
        ],
      },
    })
    await commitTransaction(req)
  } catch (e) {
    await killTransaction(req)
    const msg = String((e as Error)?.message ?? e) + String((e as { cause?: unknown })?.cause ?? '')
    if (/coach_id|starts_at|unique|duplicate|23505/i.test(msg)) return { ok: false, error: 'That make-up time clashes with another session for this coach. Choose another time.' }
    throw e
  }

  const warnings = [...quote.warnings]
  // Stop future weekly charges
  if (quote.stopWeekly) {
    try {
      await stopWeeklyCharges(booking)
    } catch (e) {
      warnings.push(`Couldn’t stop the weekly charges in Stripe: ${(e as Error).message}. Cancel the subscription in Stripe by hand.`)
      await alertAdmin(payload, booking, 'Weekly charges not stopped', `The weekly plan for ${booking.reference} was cancelled, but Stripe returned an error: ${(e as Error).message}. Please cancel the subscription in the Stripe dashboard.`)
    }
  }
  // Refund to card
  let refund = 'none'
  if (cash > 0) {
    const fresh = await payload.findByID({ collection: 'academy-bookings', id: booking.id, depth: 0, overrideAccess: true })
    refund = await runRefund(payload, fresh, key, cash)
    if (refund === 'failed') warnings.push('The card refund failed — use “Retry refund” on the booking.')
  }
  if (r.notify !== false) {
    try {
      await notifyCancellation(payload, booking, targets, { by: r.by, cash: refund === 'failed' ? 0 : cash, credit, makeUp: makeUpSession, stopWeekly: quote.stopWeekly, reason: r.reason })
    } catch (e) {
      payload.logger.error({ err: e, msg: `Cancellation emails failed for ${booking.reference}` })
    }
  }
  return { ok: true, key, cash, credit, refund, quote, warnings }
}

/** Run (or retry) the card refund for one adjustment. Idempotent per adjustment key. */
async function runRefund(payload: Payload, booking: AcademyBooking, key: string, cash: number) {
  const adjustments = [...(booking.adjustments ?? [])]
  const adj = adjustments.find((a) => a.key === key)
  if (!adj) return 'failed'
  try {
    const res = await refundToCard(booking, cash, key)
    Object.assign(adj, { refundStatus: res.status, stripeRefundIds: res.ids.join(', '), error: null })
    const live = await payload.count({ collection: 'academy-sessions', where: { booking: { equals: booking.id }, status: { not_equals: 'cancelled' } }, overrideAccess: true })
    await payload.update({
      collection: 'academy-bookings',
      id: booking.id,
      overrideAccess: true,
      data: { adjustments, refundedAmount: round((booking.refundedAmount ?? 0) + cash), ...(live.totalDocs === 0 ? { status: 'refunded' as const } : {}) },
    })
    return res.status
  } catch (e) {
    Object.assign(adj, { refundStatus: 'failed', error: String((e as Error).message ?? e).slice(0, 500) })
    await payload.update({ collection: 'academy-bookings', id: booking.id, overrideAccess: true, data: { adjustments } })
    await alertAdmin(payload, booking, `Refund failed: ${booking.reference}`, `A ${formatAUD(cash)} refund for ${booking.reference} failed: ${esc((e as Error).message)}. Open the booking and use “Retry refund”.`)
    return 'failed'
  }
}

export async function retryRefund(payload: Payload, bookingId: number, key: string) {
  const booking = await payload.findByID({ collection: 'academy-bookings', id: bookingId, depth: 0, overrideAccess: true })
  const adj = booking.adjustments?.find((a) => a.key === key)
  if (!adj || adj.refundStatus !== 'failed' || !adj.cash) return { ok: false as const, error: 'Nothing to retry.' }
  const status = await runRefund(payload, booking, key, adj.cash)
  return status === 'failed' ? { ok: false as const, error: 'The refund failed again — check the booking’s error and the Stripe dashboard.' } : { ok: true as const }
}

/** Goodwill credit without cancelling anything. */
export async function goodwillCredit(payload: Payload, r: { bookingId: number; amount: number; reason: string; actorId: number }) {
  const booking = await payload.findByID({ collection: 'academy-bookings', id: r.bookingId, depth: 0, overrideAccess: true, disableErrors: true })
  if (!booking?.account) return { ok: false as const, error: 'This booking has no family account to hold credit.' }
  if (!(r.amount > 0) || r.amount > 500) return { ok: false as const, error: 'Enter an amount between $1 and $500.' }
  if (!r.reason.trim()) return { ok: false as const, error: 'Please give a reason.' }
  await giveCredit(payload, { account: rel(booking.account)!, amount: r.amount, reason: 'goodwill', booking: booking.id, note: r.reason, createdBy: r.actorId })
  await payload.update({
    collection: 'academy-bookings',
    id: booking.id,
    overrideAccess: true,
    data: {
      adjustments: [
        ...(booking.adjustments ?? []),
        { key: randomBytes(6).toString('hex'), action: 'goodwill', by: 'admin', outcome: 'credit', credit: r.amount, cash: 0, refundStatus: 'none', rule: 'Goodwill credit', reason: r.reason, actor: r.actorId, at: new Date().toISOString() },
      ],
    },
  })
  return { ok: true as const }
}

// ── Emails ───────────────────────────────────────────────────────────────────

async function notifyCancellation(
  payload: Payload,
  booking: AcademyBooking,
  cancelled: AcademySession[],
  o: { by: CancelBy; cash: number; credit: number; makeUp?: AcademySession; stopWeekly: boolean; reason: string },
) {
  const coach = (await payload.findByID({ collection: 'academy-coaches', id: rel(booking.coach)!, depth: 1, overrideAccess: true })) as AcademyCoach
  const dates = cancelled.map((s) => when(s.startsAt))
  const whole = o.stopWeekly || cancelled.length > 1
  const rows: [string, string][] = [
    ['Player', `${booking.player.firstName} ${booking.player.lastName}`],
    ['Cancelled', dates.join(', ')],
    ...(o.makeUp ? ([['Make-up session', `${when(o.makeUp.startsAt)} (no charge)`]] as [string, string][]) : []),
    ...(o.cash > 0 ? ([['Refund to your card', `${formatAUD(o.cash)} — usually 5–10 business days`]] as [string, string][]) : []),
    ...(o.credit > 0 ? ([['Account credit', `${formatAUD(o.credit)} — used automatically next time you book while logged in`]] as [string, string][]) : []),
    ...(o.stopWeekly ? ([['Weekly payments', 'Stopped — no further charges']] as [string, string][]) : []),
    ['Reference', booking.reference],
  ]
  const nothing = !o.makeUp && o.cash <= 0 && o.credit <= 0
  const intro =
    o.by === 'coach'
      ? `Hi ${esc(booking.contact.firstName)}, we’re sorry — ${esc(coach.displayName)} can’t take ${esc(booking.player.firstName)}’s ${dates.length === 1 ? 'session' : 'sessions'} on ${esc(dates.join(', '))}.${o.makeUp ? ' We’ve booked a free make-up session instead.' : ''}`
      : `Hi ${esc(booking.contact.firstName)}, as requested we’ve cancelled ${esc(booking.player.firstName)}’s ${whole ? 'remaining 1-on-1s' : '1-on-1'} with ${esc(coach.displayName)}.${nothing ? ' Under our cancellation policy there’s no refund or credit for this cancellation.' : ''}`
  const html = emailLayout('academy', [
    {
      heading: o.makeUp ? 'Make-up session booked' : whole ? 'Your 1-on-1s are cancelled' : 'Session cancelled',
      intro,
      rows,
      after: 'Questions? Reply to this email or call ' + esc(academyBrand.phone) + '.',
      cta: { label: o.credit > 0 ? 'Book with your credit' : 'View my account', href: `${siteUrl()}${o.credit > 0 ? '/academy/1-on-1' : '/account'}` },
    },
  ])
  await sendEmail(payload, { to: booking.contact.email, subject: o.makeUp ? `Make-up session booked for ${booking.player.firstName}` : `Cancelled: ${booking.player.firstName}’s 1-on-1${whole ? 's' : ''} with ${coach.displayName}`, html, sender: 'academy', userId: rel(booking.account) })

  // Tell the coach (and the make-up coach if different)
  const coachUser = typeof coach.user === 'object' ? coach.user : null
  if (coachUser?.email) {
    const coachHtml = emailLayout('academy', [
      {
        heading: 'Session cancelled',
        intro: `${esc(booking.player.firstName)} ${esc(booking.player.lastName)}’s ${dates.length === 1 ? 'session' : 'sessions'} on ${esc(dates.join(', '))} ${dates.length === 1 ? 'is' : 'are'} cancelled (${o.by === 'coach' ? 'coach cancellation' : 'family request'}).${o.makeUp ? ` Make-up booked: ${esc(when(o.makeUp.startsAt))}.` : ''}`,
        cta: { label: 'Open my sessions', href: `${siteUrl()}/coach/sessions` },
      },
    ])
    await sendEmail(payload, { to: coachUser.email, subject: `Cancelled: ${booking.player.firstName} ${dates.length === 1 ? day(cancelled[0].startsAt) : `(${dates.length} sessions)`}`, html: coachHtml, sender: 'academy', userId: coachUser.id })
  }
}

async function alertAdmin(payload: Payload, booking: AcademyBooking, subject: string, intro: string) {
  const html = emailLayout('academy', [{ heading: subject, intro, cta: { label: 'Open booking', href: `${siteUrl()}/staff/academy/bookings/${booking.id}` } }])
  await sendEmail(payload, { to: academyBrand.email, subject, html, sender: 'academy' })
}
