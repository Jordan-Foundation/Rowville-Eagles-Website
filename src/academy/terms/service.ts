import type { Payload } from 'payload'
import type { AcademyRegistration, AcademyTermSlot, Booking, Program, User } from '@/payload-types'
import { academyBrand } from '../brand'
import { defaultPayee } from '../../collections/Programs'
import { groupLabel } from '../../lib/age-groups'
import { sendEmail } from '../../lib/email'
import { emailLayout, esc } from '../../lib/email-templates'
import { formatAUD, formatDate } from '../../lib/format'
import { confirmPayment, newReference, siteUrl, startCheckout } from '../../lib/payments'
import { sendSms } from '../../lib/sms'
import { isPayee } from '../../lib/stripe-accounts'
import { slotLabel, termQuote, upcomingSessions, yearsLabel } from './slots'

const rel = (v: number | { id: number } | null | undefined) => (v && typeof v === 'object' ? v.id : (v ?? null))
const HOLD_MS = 35 * 60 * 1000
const DAY = 86_400_000
export const OFFER_HOLD_DAYS = 7

export async function programSlots(payload: Payload, programId: number) {
  const { docs } = await payload.find({ collection: 'academy-term-slots', where: { program: { equals: programId } }, sort: 'title', limit: 100, depth: 0, overrideAccess: true })
  return docs
}

/** Places taken per slot: paid, being paid right now (35 min), or offered and still held. */
export async function slotTaken(payload: Payload, programId: number, now = new Date()) {
  const { docs } = await payload.find({
    collection: 'academy-registrations',
    where: {
      program: { equals: programId },
      slot: { exists: true },
      or: [
        { status: { equals: 'paid' } },
        { and: [{ status: { equals: 'pending_payment' } }, { updatedAt: { greater_than: new Date(now.getTime() - HOLD_MS).toISOString() } }] },
        { and: [{ status: { equals: 'offered' } }, { offerExpiresAt: { greater_than: now.toISOString() } }] },
      ],
    },
    limit: 5000,
    depth: 0,
    overrideAccess: true,
    select: { slot: true },
  })
  const taken = new Map<number, number>()
  for (const r of docs) {
    const id = rel(r.slot)
    if (id) taken.set(id, (taken.get(id) ?? 0) + 1)
  }
  return taken
}

/** The same player already in this program (by name + date of birth). */
export async function existingRegistration(payload: Payload, programId: number, player: { firstName: string; lastName: string; dateOfBirth: string }) {
  const { docs } = await payload.find({
    collection: 'academy-registrations',
    where: { program: { equals: programId }, status: { not_equals: 'cancelled' }, 'player.firstName': { like: player.firstName }, 'player.lastName': { like: player.lastName } },
    limit: 20,
    depth: 0,
    overrideAccess: true,
    showHiddenFields: true,
  })
  const day = player.dateOfBirth.slice(0, 10)
  return docs.find((d) => d.player.firstName.trim().toLowerCase() === player.firstName.trim().toLowerCase() && d.player.lastName.trim().toLowerCase() === player.lastName.trim().toLowerCase() && d.player.dateOfBirth.slice(0, 10) === day) ?? null
}

export const payeeOf = (program: Pick<Program, 'payee' | 'type'>) => (isPayee(program.payee) ? program.payee : defaultPayee(program.type))

export class TermClosedError extends Error {
  constructor() {
    super('There aren’t enough sessions left this term to join this training time.')
  }
}

/** "8 sessions × $25 = $200" */
export const quoteLabel = (q: ReturnType<typeof termQuote>) => (q.perSession !== null ? `${q.count} sessions × ${formatAUD(q.perSession)} = ${formatAUD(q.total)}` : formatAUD(q.total))

/** Create the payment for a registration and return where to send the family (Stripe, or success when free). */
export async function checkoutRegistration(payload: Payload, reg: AcademyRegistration, program: Program, slot: AcademyTermSlot, cancelPath: string) {
  const quote = termQuote(slot, program, program)
  if (!quote.bookable) throw new TermClosedError()
  const amount = quote.total
  const payee = payeeOf(program)
  const reference = newReference(payee)
  const booking = await payload.create({
    collection: 'bookings',
    overrideAccess: true,
    data: {
      reference,
      program: program.id,
      status: 'pending',
      payee,
      amount,
      birthYear: reg.playingBirthYear ?? reg.birthYear ?? undefined,
      account: rel(reg.account) ?? undefined,
      participant: rel(reg.participant) ?? undefined,
      academyRegistration: reg.id,
      contact: reg.contact,
      player: { ...reg.player, teamName: undefined },
    },
  })
  await payload.update({ collection: 'academy-registrations', id: reg.id, overrideAccess: true, data: { status: 'pending_payment', slot: slot.id, booking: booking.id, amount } })
  if (!amount) {
    await confirmPayment(payload, 'booking', reference)
    return `/checkout/success?kind=booking&ref=${reference}`
  }
  try {
    const checkout = await startCheckout({
      payee,
      kind: 'booking',
      reference,
      email: reg.contact.email,
      items:
        quote.perSession !== null
          ? [{ name: `${program.title} — ${quote.count} sessions`, description: `${reg.player.firstName} ${reg.player.lastName} · ${slotLabel(slot)}`, unitAmount: quote.perSession, quantity: quote.count }]
          : [{ name: program.title, description: `${reg.player.firstName} ${reg.player.lastName} · ${slotLabel(slot)}`, unitAmount: amount, quantity: 1 }],
      cancelPath,
    })
    if (checkout.sessionId) await payload.update({ collection: 'bookings', id: booking.id, overrideAccess: true, data: { stripeCheckoutId: checkout.sessionId } })
    return checkout.url
  } catch (e) {
    await payload.update({ collection: 'bookings', id: booking.id, overrideAccess: true, data: { status: 'cancelled' } })
    throw e
  }
}

// ── Emails ───────────────────────────────────────────────────────────────────

/** Rows describing the training time, for emails. */
export function slotRows(slot: AcademyTermSlot, program: Pick<Program, 'startDate' | 'endDate'>): [string, string][] {
  const sessions = upcomingSessions(slot, program)
  return [
    ['Training', slotLabel(slot)],
    ['Age groups', yearsLabel(slot.birthYears)],
    ...(sessions.length
      ? ([
          ['First session', formatDate(sessions[0].startsAt, { weekday: 'long', day: 'numeric', month: 'long' })],
          ['Sessions', `${sessions.length} (to ${formatDate(sessions.at(-1)!.startsAt, { day: 'numeric', month: 'long' })})`],
        ] as [string, string][])
      : []),
  ]
}

export async function emailInterest(payload: Payload, reg: AcademyRegistration, program: Program, reason: 'no_slot' | 'full') {
  const by = reg.birthYear ? groupLabel(reg.birthYear) : ''
  const html = emailLayout('academy', [
    {
      heading: 'Interest registered',
      intro: `Thanks ${esc(reg.contact.firstName)} — we’ve registered ${esc(reg.player.firstName)}’s interest in <strong>${esc(program.title)}</strong>. ${
        reason === 'full' ? `The ${esc(by)} training times are currently full` : `There isn’t a training time for ${esc(by)} yet`
      }, so you haven’t been charged. We’ll email you as soon as a place is available, with a link to confirm and pay.`,
      rows: [
        ['Player', `${reg.player.firstName} ${reg.player.lastName}`],
        ['Age group', by],
        ['Reference', reg.reference ?? ''],
      ],
    },
  ])
  await sendEmail(payload, { to: reg.contact.email, subject: `Interest registered: ${program.title}`, html, sender: 'academy', userId: rel(reg.account) ?? undefined })
  const staff = emailLayout('academy', [
    {
      heading: 'New term interest',
      intro: `${esc(reg.player.firstName)} ${esc(reg.player.lastName)} (${esc(by)}) registered interest in ${esc(program.title)} — ${reason === 'full' ? 'their training times are full' : 'no training time for their age group'}. Offer a place from the staff Academy terms page.`,
      rows: [
        ['Parent', `${reg.contact.firstName} ${reg.contact.lastName}`],
        ['Email', reg.contact.email],
        ['Mobile', reg.contact.phone],
      ],
      cta: { label: 'Open Academy terms', href: `${siteUrl()}/staff/academy/terms?program=${program.id}` },
    },
  ])
  await sendEmail(payload, { to: academyBrand.email, subject: `Term interest: ${reg.player.firstName} ${reg.player.lastName} (${by})`, html: staff, sender: 'academy' })
}

export const termPayUrl = (reg: Pick<AcademyRegistration, 'reference' | 'token'>) => `${siteUrl()}/academy/terms/pay/${reg.reference}${reg.token ? `?t=${reg.token}` : ''}`

/** Staff offer a place in a slot (from interest, or a different slot): email + SMS with the pay link. */
export async function offerSlot(payload: Payload, regId: number, slotId: number, o: { actorId: number; holdDays?: number }) {
  const reg = await payload.findByID({ collection: 'academy-registrations', id: regId, depth: 0, overrideAccess: true, showHiddenFields: true })
  if (reg.status === 'paid' || reg.status === 'cancelled') throw new Error('This registration is already paid or cancelled.')
  const [slot, program] = await Promise.all([
    payload.findByID({ collection: 'academy-term-slots', id: slotId, depth: 0, overrideAccess: true }),
    payload.findByID({ collection: 'programs', id: rel(reg.program)!, depth: 0, overrideAccess: true }),
  ])
  if (rel(slot.program) !== program.id) throw new Error('That slot belongs to another program.')
  const now = new Date()
  const until = new Date(now.getTime() + (o.holdDays ?? OFFER_HOLD_DAYS) * DAY)
  const updated = await payload.update({
    collection: 'academy-registrations',
    id: reg.id,
    overrideAccess: true,
    showHiddenFields: true,
    data: { status: 'offered', slot: slot.id, offeredAt: now.toISOString(), offerExpiresAt: until.toISOString(), amount: termQuote(slot, program, program, until).total },
  })
  const url = termPayUrl(updated)
  const due = formatDate(until.toISOString(), { weekday: 'long', day: 'numeric', month: 'long' })
  const html = emailLayout('academy', [
    {
      heading: 'A place is ready',
      intro: `Hi ${esc(reg.contact.firstName)}, we have a place for ${esc(reg.player.firstName)} in <strong>${esc(program.title)}</strong>. Please confirm and pay by <strong>${esc(due)}</strong> to secure it.`,
      rows: [['Player', `${reg.player.firstName} ${reg.player.lastName}`], ...slotRows(slot, program), ['Price', `${quoteLabel(termQuote(slot, program, program))} if you pay today`], ['Confirm by', due]],
      cta: { label: 'Confirm and pay', href: url },
      after: 'If this time doesn’t suit, just reply to this email and we’ll see what else we can do.',
    },
  ])
  const user = reg.account ? ((await payload.findByID({ collection: 'users', id: rel(reg.account)!, depth: 0, overrideAccess: true, disableErrors: true })) as User | null) : null
  await sendEmail(payload, { to: reg.contact.email, subject: `A place for ${reg.player.firstName}: ${program.title}`, html, sender: 'academy', userId: user?.id })
  await sendSms(payload, {
    to: reg.contact.phone,
    kind: 'service',
    optedOut: user?.smsOptOut,
    userId: user?.id,
    body: `A place is ready for ${reg.player.firstName} in ${program.title} (${slotLabel(slot)}). Confirm and pay by ${due}: ${url} – Foundation Academy`,
  })
  return updated
}

/** Called from onBookingPaid when the booking pays for a term registration. */
export async function markTermRegistrationPaid(payload: Payload, booking: Booking) {
  const id = rel(booking.academyRegistration)
  if (!id) return null
  return payload.update({
    collection: 'academy-registrations',
    id,
    overrideAccess: true,
    data: { status: 'paid', paidAt: new Date().toISOString(), booking: booking.id, account: rel(booking.account), participant: rel(booking.participant) },
  })
}
