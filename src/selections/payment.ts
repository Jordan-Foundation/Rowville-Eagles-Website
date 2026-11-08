import type { Payload } from 'payload'
import type { Booking, Program, SelectionEntry, SelectionRound, Squad, User } from '@/payload-types'
import { defaultPayee } from '../collections/Programs'
import { sendEmail } from '../lib/email'
import { emailLayout, esc } from '../lib/email-templates'
import { formatAUD, formatDate } from '../lib/format'
import { siteUrl } from '../lib/payments'
import { sendSms } from '../lib/sms'
import { joinFromEntry } from '../teams/service'

/**
 * Paying after selection: selected (tournament) and successful (Rowville) players complete registration
 * on /selections/pay/<ref>. Deadlines and reminders are per round; staff release unpaid spots by hand.
 */

const DAY = 86_400_000
const rel = (v: number | { id: number } | null | undefined) => (v && typeof v === 'object' ? v.id : (v ?? null))

export const awaitingPayment = (e: Pick<SelectionEntry, 'status'>) => e.status === 'selected' || e.status === 'offered'

/** Private link from the email/SMS — works without logging in. */
export const payUrl = (e: Pick<SelectionEntry, 'reference' | 'token'>) => `${siteUrl()}/selections/pay/${e.reference}${e.token ? `?t=${e.token}` : ''}`

export function feeFor(round: Pick<SelectionRound, 'kind' | 'fee'>, squad: Pick<Squad, 'fee'> | null, program: Pick<Program, 'price'> | null) {
  if (round.kind === 'rowville') return program?.price ?? 0
  return squad?.fee ?? round.fee ?? program?.price ?? 0
}

export const payeeFor = (program: Pick<Program, 'payee' | 'type'>) => program.payee ?? defaultPayee(program.type)

/** Deadline from when the outcome is sent. */
export const dueDate = (from: Date, days: number | null | undefined) => new Date(from.getTime() + (days ?? 7) * DAY).toISOString()

/**
 * Which reminder (days before the deadline) is due now, if any — the smallest threshold we've reached
 * that hasn't been sent. Nothing once the deadline has passed (staff decide what happens then).
 */
export function reminderDue(e: Pick<SelectionEntry, 'status' | 'paymentDueAt' | 'remindersSent'>, reminderDays: number[], now: Date): number | null {
  if (!awaitingPayment(e) || !e.paymentDueAt) return null
  const left = new Date(e.paymentDueAt).getTime() - now.getTime()
  if (left <= 0) return null
  const sent = new Set(e.remindersSent ?? [])
  const reached = [...new Set(reminderDays)].filter((d) => left <= d * DAY && !sent.has(d)).sort((a, b) => a - b)
  return reached[0] ?? null
}

export const isOverdue = (e: Pick<SelectionEntry, 'status' | 'paymentDueAt'>, now = new Date()) => awaitingPayment(e) && Boolean(e.paymentDueAt) && new Date(e.paymentDueAt!).getTime() < now.getTime()

// ── Reminders ────────────────────────────────────────────────────────────────

async function context(payload: Payload, e: SelectionEntry) {
  const round = (typeof e.round === 'object' ? e.round : await payload.findByID({ collection: 'selection-rounds', id: e.round, depth: 1, overrideAccess: true })) as SelectionRound
  const program = round.program && typeof round.program === 'object' ? (round.program as Program) : round.program ? await payload.findByID({ collection: 'programs', id: rel(round.program)!, depth: 0, overrideAccess: true }) : null
  const squad = e.squad ? (typeof e.squad === 'object' ? (e.squad as Squad) : await payload.findByID({ collection: 'squads', id: e.squad, depth: 0, overrideAccess: true })) : null
  const brand: 'club' | 'academy' = round.kind === 'tournament' && program?.brand === 'academy' ? 'academy' : 'club'
  const event = round.kind === 'tournament' ? (program?.title ?? round.title) : `Rowville Eagles ${round.season}`
  return { round, program, squad, brand, event }
}

export async function sendPaymentReminder(payload: Payload, e: SelectionEntry, daysBefore: number | 'now') {
  const { round, program, squad, brand, event } = await context(payload, e)
  const fee = feeFor(round, squad, program)
  const due = e.paymentDueAt ? formatDate(e.paymentDueAt, { weekday: 'long', day: 'numeric', month: 'long' }) : 'soon'
  const url = payUrl(e)
  const html = emailLayout(brand, [
    {
      heading: 'Reminder: complete registration',
      intro: `Hi ${esc(e.contact.firstName)}, ${esc(e.player.firstName)}’s place in <strong>${esc(squad?.name ?? event)}</strong> is waiting — please complete registration by <strong>${esc(due)}</strong> so we can confirm it.`,
      rows: [
        ['Player', `${e.player.firstName} ${e.player.lastName}`],
        ['Team', squad?.name ?? ''],
        ['Fee', formatAUD(fee)],
        ['Pay by', due],
      ],
      cta: { label: 'Complete registration', href: url },
      after: 'If you can no longer take the place, just reply to this email so we can offer it to another player.',
    },
  ])
  const user = e.account ? ((await payload.findByID({ collection: 'users', id: rel(e.account)!, depth: 0, overrideAccess: true, disableErrors: true })) as User | null) : null
  await sendEmail(payload, { to: e.contact.email, subject: `Reminder: complete ${e.player.firstName}’s registration — ${event}`, html, sender: brand, userId: user?.id })
  await sendSms(payload, {
    to: e.contact.phone,
    kind: 'service',
    optedOut: user?.smsOptOut,
    body: `Reminder: please complete ${e.player.firstName}’s registration for ${squad?.name ?? event} by ${due}: ${url} – ${brand === 'academy' ? 'Foundation Academy' : 'Rowville Eagles'}`,
  })
  if (daysBefore !== 'now') {
    await payload.update({ collection: 'selection-entries', id: e.id, overrideAccess: true, context: { skipOffer: true }, data: { remindersSent: [...(e.remindersSent ?? []), daysBefore] } })
  }
}

/** Daily: reminders for players who haven't paid yet. */
export async function runSelectionReminders(payload: Payload, now = new Date()) {
  const { docs } = await payload.find({
    collection: 'selection-entries',
    where: { status: { in: ['selected', 'offered'] }, paymentDueAt: { greater_than: now.toISOString() } },
    limit: 2000,
    depth: 1,
    overrideAccess: true,
    showHiddenFields: true,
  })
  const result = { checked: docs.length, sent: 0 }
  for (const e of docs) {
    const round = e.round as SelectionRound
    const d = reminderDue(e, (round.reminderDays as number[] | null) ?? [3, 1], now)
    if (d === null) continue
    try {
      await sendPaymentReminder(payload, e, d)
      result.sent++
    } catch (err) {
      payload.logger.error({ err, msg: `Payment reminder for ${e.reference} failed` })
    }
  }
  return result
}

// ── Release / paid ───────────────────────────────────────────────────────────

export async function releaseEntries(payload: Payload, ids: number[], o: { email: boolean; actorId: number }) {
  const { docs } = await payload.find({ pagination: false, collection: 'selection-entries', where: { id: { in: ids } }, limit: ids.length, depth: 1, overrideAccess: true })
  let released = 0
  for (const e of docs) {
    if (!awaitingPayment(e)) continue
    await payload.update({ collection: 'selection-entries', id: e.id, overrideAccess: true, context: { skipOffer: true }, data: { status: 'released', releasedAt: new Date().toISOString(), outcomeSentBy: o.actorId } })
    // Rowville: withdraw the registration offer on the player record
    if (e.kind === 'rowville' && e.participant) {
      const kid = await payload.findByID({ collection: 'participants', id: rel(e.participant)!, depth: 0, overrideAccess: true, disableErrors: true })
      if (kid?.registrationOffer?.status === 'offered') await payload.update({ collection: 'participants', id: kid.id, overrideAccess: true, data: { registrationOffer: { program: null, status: null } } })
    }
    if (o.email) {
      const { squad, brand, event } = await context(payload, e)
      const html = emailLayout(brand, [
        {
          heading: 'Place released',
          intro: `Hi ${esc(e.contact.firstName)}, as we didn’t receive ${esc(e.player.firstName)}’s registration in time, we’ve released the place in ${esc(squad?.name ?? event)} to another player. If you think this is a mistake, please reply to this email.`,
        },
      ])
      await sendEmail(payload, { to: e.contact.email, subject: `Place released — ${event}`, html, sender: brand, userId: rel(e.account) ?? undefined })
    }
    released++
  }
  return released
}

/** Called after a selection's registration payment is confirmed. */
export async function markSelectionPaid(payload: Payload, booking: Booking) {
  const id = rel(booking.selectionEntry)
  if (!id) return
  const entry = await payload.update({
    collection: 'selection-entries',
    id,
    overrideAccess: true,
    context: { skipOffer: true },
    data: { status: 'registered', paidAt: new Date().toISOString(), booking: booking.id, account: rel(booking.account), participant: rel(booking.participant) },
  })
  // Join the squad's team (and its team page)
  try {
    await joinFromEntry(payload, entry)
  } catch (err) {
    payload.logger.error({ err, msg: `Adding ${entry.reference} to the team failed — the daily sync will retry` })
  }
}
