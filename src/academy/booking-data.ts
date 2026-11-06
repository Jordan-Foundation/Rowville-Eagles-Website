import type { Payload } from 'payload'
import { commitTransaction, createLocalReq, initTransaction, killTransaction } from 'payload'
import type { AcademyBooking, AcademyCoach, AcademyTerm, Media } from '@/payload-types'
import type { CoachAvailability } from './slots'
import { accountLink, addMembership, ensureAccount, findOrCreateParticipant } from '../lib/accounts'
import { recordConsent } from '../lib/consent'
import { CONSENT_WORDING } from '../lib/consent-wording'
import { emailLayout, esc } from '../lib/email-templates'
import { sendEmail } from '../lib/email'
import { formatAUD, formatDate } from '../lib/format'
import { academyBrand } from './brand'
import { alertCoverNeeded } from './cover'

/** Stripe Checkout links last at least 30 minutes, so a hold must never be shorter than that. */
export const holdMinutesFor = (term: Pick<AcademyTerm, 'holdMinutes'>) => Math.max(30, term.holdMinutes ?? 30)

const id = (v: number | { id: number } | null | undefined) => (v && typeof v === 'object' ? v.id : (v ?? undefined))

/** Release holds whose checkout time ran out (called before every slot lookup and booking attempt). */
export async function releaseExpiredHolds(payload: Payload) {
  const { docs } = await payload.find({
    collection: 'academy-bookings',
    where: { status: { equals: 'held' }, holdExpiresAt: { less_than: new Date().toISOString() } },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })
  for (const b of docs) await releaseBooking(payload, b, 'expired')
  return { released: docs.length }
}

async function releaseBooking(payload: Payload, booking: AcademyBooking, status: 'expired' | 'cancelled') {
  await payload.update({ collection: 'academy-sessions', where: { booking: { equals: booking.id } }, data: { status: 'cancelled' }, overrideAccess: true })
  await payload.update({ collection: 'academy-bookings', id: booking.id, data: { status }, overrideAccess: true })
}

export async function openTerms(payload: Payload) {
  const { docs } = await payload.find({ collection: 'academy-terms', where: { status: { equals: 'open' }, endDate: { greater_than: new Date().toISOString() } }, sort: 'startDate', depth: 0, limit: 6 })
  return docs
}

export type PublicCoach = { id: number; name: string; photo: string | null; bio: string; specialties: string[] }

/** Everything the slot engine needs for a term, plus the public coach cards. */
export async function loadTermBookingData(payload: Payload, term: AcademyTerm) {
  const [{ docs: coaches }, { docs: avail }] = await Promise.all([
    payload.find({ collection: 'academy-coaches', where: { active: { equals: true } }, depth: 1, limit: 200, sort: 'order' }),
    payload.find({ collection: 'academy-availability', where: { term: { equals: term.id } }, depth: 0, limit: 500, overrideAccess: true }),
  ])
  const activeIds = new Set(coaches.map((c) => c.id))
  const { docs: live } = await payload.find({
    collection: 'academy-sessions',
    where: { status: { not_equals: 'cancelled' }, startsAt: { greater_than: new Date().toISOString(), less_than_equal: term.endDate }, coach: { in: [...activeIds] } },
    depth: 0,
    limit: 5000,
    overrideAccess: true,
    select: { coach: true, startsAt: true },
  })
  const availability: CoachAvailability[] = avail
    .filter((a) => activeIds.has(id(a.coach)!))
    .map((a) => ({
      coachId: id(a.coach)!,
      slots: (a.slots ?? []).map((s) => ({ weekday: s.weekday, startTime: s.startTime })),
      away: (a.awayPeriods ?? []).map((w) => ({ from: w.from, to: w.to })),
    }))
  const cards: PublicCoach[] = coaches.map((c: AcademyCoach) => ({
    id: c.id,
    name: c.displayName,
    photo: (typeof c.photo === 'object' ? (c.photo as Media | null)?.url : null) ?? null,
    bio: c.bio ?? '',
    specialties: (c.specialties ?? []).map((s) => s.label),
  }))
  return { availability, taken: live.map((s) => ({ coachId: id(s.coach)!, startsAt: s.startsAt })), coaches: cards }
}

type HoldInput = Omit<AcademyBooking, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'holdExpiresAt'> & {
  sessions: { startsAt: string; needsCover?: boolean }[]
  holdMinutes: number
}

/**
 * Atomically create a held booking and its session rows. If any session clashes with a live one,
 * the database's unique index rejects it and the whole thing is rolled back.
 */
export async function createHold(payload: Payload, input: HoldInput): Promise<{ ok: true; booking: AcademyBooking } | { ok: false }> {
  const { sessions, holdMinutes, ...data } = input
  const req = await createLocalReq({}, payload)
  await initTransaction(req)
  try {
    const booking = await payload.create({
      collection: 'academy-bookings',
      overrideAccess: true,
      req,
      data: { ...data, status: 'held', holdExpiresAt: new Date(Date.now() + (holdMinutes + 2) * 60000).toISOString() },
    })
    for (const s of sessions) {
      await payload.create({
        collection: 'academy-sessions',
        overrideAccess: true,
        req,
        data: { booking: booking.id, coach: id(data.coach)!, startsAt: s.startsAt, status: 'held', account: id(data.account), needsCover: Boolean(s.needsCover) },
      })
    }
    await commitTransaction(req)
    return { ok: true, booking }
  } catch (e) {
    await killTransaction(req)
    // The database's unique (coach, start) index rejected a session — someone else holds or booked it.
    // Payload reports this as a ValidationError naming the indexed columns.
    const msg = String((e as Error)?.message ?? e) + String((e as { cause?: unknown })?.cause ?? '')
    if (/coach_id|starts_at|unique|duplicate|23505/i.test(msg)) return { ok: false }
    throw e
  }
}

async function findBooking(payload: Payload, reference: string) {
  const { docs } = await payload.find({ collection: 'academy-bookings', where: { reference: { equals: reference } }, limit: 1, depth: 0, overrideAccess: true })
  return docs[0]
}

/** Payment confirmed (webhook, success page or simulate mode). Idempotent. */
export async function confirmAcademyBooking(payload: Payload, reference: string): Promise<AcademyBooking | undefined> {
  const booking = await findBooking(payload, reference)
  if (!booking || booking.status === 'confirmed' || booking.status === 'completed') return booking
  if (booking.status === 'expired' || booking.status === 'cancelled') {
    // Paid after the hold ran out: take the slot back if it's still free, otherwise flag for a refund
    try {
      await payload.update({ collection: 'academy-sessions', where: { booking: { equals: booking.id } }, data: { status: 'held' }, overrideAccess: true })
    } catch {
      await payload.update({ collection: 'academy-bookings', id: booking.id, data: { status: 'payment_failed' }, overrideAccess: true })
      payload.logger.error(`Academy booking ${reference} was paid after its hold expired and the slot was taken — refund needed`)
      return booking
    }
  }
  await payload.update({ collection: 'academy-sessions', where: { booking: { equals: booking.id } }, data: { status: 'scheduled', paid: booking.paymentMode !== 'weekly' }, overrideAccess: true })
  const confirmed = await payload.update({
    collection: 'academy-bookings',
    id: booking.id,
    data: { status: 'confirmed', sessionsPaid: booking.paymentMode === 'weekly' ? 1 : booking.sessionsTotal },
    overrideAccess: true,
  })
  try {
    await afterConfirmed(payload, confirmed)
  } catch (e) {
    payload.logger.error({ err: e, msg: `Post-confirmation steps failed for ${reference}` })
  }
  return confirmed
}

/** Checkout abandoned or expired at Stripe. */
export async function releaseAcademyHold(payload: Payload, reference: string) {
  const booking = await findBooking(payload, reference)
  if (booking?.status === 'held') await releaseBooking(payload, booking, 'expired')
}

/** Link to the family's account (creating it for guests), tag the player RFA, record opt-in, send confirmation. */
async function afterConfirmed(payload: Payload, booking: AcademyBooking) {
  const { user } = booking.account
    ? { user: await payload.findByID({ collection: 'users', id: id(booking.account)!, depth: 0, overrideAccess: true }) }
    : await ensureAccount(payload, { email: booking.contact.email, firstName: booking.contact.firstName, lastName: booking.contact.lastName, phone: booking.contact.mobile })
  const participant = booking.participant
    ? await payload.findByID({ collection: 'participants', id: id(booking.participant)!, depth: 0, overrideAccess: true })
    : await findOrCreateParticipant(payload, user.id, { firstName: booking.player.firstName, lastName: booking.player.lastName, dateOfBirth: booking.player.dateOfBirth })
  await addMembership(payload, participant, 'rfa')
  await payload.update({ collection: 'academy-bookings', id: booking.id, data: { account: user.id, participant: participant.id }, overrideAccess: true })
  await payload.update({ collection: 'academy-sessions', where: { booking: { equals: booking.id } }, data: { account: user.id }, overrideAccess: true })

  if (booking.marketingOptIn) {
    const fresh = await payload.findByID({ collection: 'users', id: user.id, depth: 0, overrideAccess: true })
    for (const channel of ['marketing_email', 'marketing_sms'] as const) {
      const on = channel === 'marketing_email' ? fresh.marketingEmail : fresh.marketingSms
      if (!on) await recordConsent(payload, fresh, { channel, action: 'granted', wording: CONSENT_WORDING.checkoutOptIn, source: 'checkout', basis: 'express' })
    }
  }

  const [coach, term] = await Promise.all([
    payload.findByID({ collection: 'academy-coaches', id: id(booking.coach)!, depth: 0, overrideAccess: true }),
    payload.findByID({ collection: 'academy-terms', id: id(booking.term)!, depth: 0 }),
  ])
  const { docs: sessions } = await payload.find({ collection: 'academy-sessions', where: { booking: { equals: booking.id } }, sort: 'startsAt', limit: 60, depth: 0, overrideAccess: true })
  const when = (iso: string) => formatDate(iso, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })
  const link = await accountLink(payload, user)
  const coverDates = sessions.filter((x) => x.needsCover).map((x) => formatDate(x.startsAt, { weekday: 'short', day: 'numeric', month: 'short' }))
  const dateList =
    sessions.length > 1
      ? `<strong>Your ${sessions.length} sessions:</strong><br>${sessions.map((x) => esc(formatDate(x.startsAt, { weekday: 'short', day: 'numeric', month: 'short' })) + (x.needsCover ? ' — replacement coach' : '')).join('<br>')}`
      : ''
  const coverNote = coverDates.length
    ? `<br><br><strong>${esc(coach.displayName)} will be away for ${coverDates.length} of these sessions (${esc(coverDates.join(', '))}).</strong> A suitable replacement coach will be allocated for those sessions, with a detailed handover from ${esc(coach.displayName)} to make sure progress continues while they’re away.`
    : ''
  if (coverDates.length) await alertCoverNeeded(payload, coach, sessions.filter((x) => x.needsCover), `is away for part of a new term booking (${booking.reference})`)
  const html = emailLayout('academy', [
    {
      heading: booking.type === 'casual' ? 'Your 1-on-1 is booked' : 'Your term of 1-on-1s is booked',
      intro: `Thanks ${esc(booking.contact.firstName)} — ${esc(booking.player.firstName)} is booked in with ${esc(coach.displayName)}.`,
      rows: [
        ['Coach', coach.displayName],
        [booking.type === 'casual' ? 'When' : 'First session', when(sessions[0]?.startsAt ?? booking.firstSessionAt ?? '')],
        ...(sessions.length > 1
          ? ([
              ['Weekly', `${formatDate(sessions[0].startsAt, { weekday: 'long' })}s at ${formatDate(sessions[0].startsAt, { hour: 'numeric', minute: '2-digit' })}`],
              ['Sessions', `${sessions.length} (${formatDate(sessions[0].startsAt, { day: 'numeric', month: 'short' })} – ${formatDate(sessions.at(-1)!.startsAt, { day: 'numeric', month: 'short' })})`],
            ] as [string, string][])
          : []),
        ['Where', term.location || academyBrand.address],
        ['Player', `${booking.player.firstName} ${booking.player.lastName}`],
        ['Paid', formatAUD(booking.amount)],
        ['Reference', booking.reference],
      ],
      after: `${dateList}${coverNote}${dateList || coverNote ? '<br><br>' : ''}Please bring boots, shin pads, a ball and a water bottle, and arrive 5 minutes early. Need to change something? Reply to this email.`,
    },
    {
      heading: user.activated ? 'See it in your account' : 'Create your free account',
      intro: user.activated
        ? 'This booking is now in your account, along with all your sessions and payments.'
        : 'Keep every session in one place: see upcoming and past sessions, manage bookings, view payment history, rebook faster, and get club updates — with the player development pathway coming soon.',
      cta: link,
    },
  ])
  await sendEmail(payload, { to: booking.contact.email, subject: `Booked: 1-on-1 with ${coach.displayName}`, html, sender: 'academy', userId: user.id })
}
