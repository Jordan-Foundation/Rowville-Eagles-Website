import { clubFeeNote, isPerTerm, perTermQuote, slotCounts } from './pricing'
import { brandOf } from './brand-of'
import type { Payload } from 'payload'
import type { AcademyRegistration, AcademyTermSlot, Booking, Program, User } from '@/payload-types'
import { academyBrand, clubBrand } from '../brand'
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
  const { docs } = await payload.find({ pagination: false, collection: 'academy-term-slots', where: { program: { equals: programId } }, sort: 'title', limit: 100, depth: 0, overrideAccess: true })
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

/** Rate for one or two nights a week. */
export const nightRate = (program: Pick<Program, 'pricePerSession' | 'twoNightPricePerSession' | 'price'>, nights: 1 | 2) =>
  nights === 2 && program.twoNightPricePerSession != null ? { pricePerSession: program.twoNightPricePerSession, price: program.price } : { pricePerSession: program.pricePerSession, price: program.price }

/**
 * Create one payment for a registration — or both nights of a 2-nights-a-week place — and return where
 * to send the family (Stripe, or the success page when free).
 */
/** The $950 note for checkouts and emails (amount from Academy settings). */
export async function feeNote(payload: Payload) {
  const s = await payload.findGlobal({ slug: 'academy-settings', depth: 0, overrideAccess: true }).catch(() => null)
  return clubFeeNote(s?.clubRegistrationFee)
}

export async function checkoutRegistrations(payload: Payload, items: { reg: AcademyRegistration; slot: AcademyTermSlot }[], program: Program, cancelPath: string) {
  const nights = items.length === 2 ? 2 : 1
  const rate = nightRate(program, nights)
  const quotes = items.map((i) => ({ ...i, quote: termQuote(i.slot, program, rate) }))
  if (quotes.some((q) => !q.quote.bookable)) throw new TermClosedError()
  // Terms 1 and 4: one term price (2 sessions a week), pro-rata — shared across the nights
  const perTerm = isPerTerm(program) ? perTermQuote(program, items.map((i) => slotCounts(i.slot, program))) : null
  if (perTerm) quotes.forEach((q, n) => { q.quote = { ...q.quote, total: perTerm.shares[n], perSession: null } })
  const full = Math.round(quotes.reduce((n, q) => n + q.quote.total, 0) * 100) / 100
  const primary = quotes[0].reg
  const payee = payeeOf(program)
  const reference = newReference(payee)
  // Promotion for this family (group terms and Mini Ballers), spread over both nights of a 2-nights place
  const { findDiscount, recordUse } = await import('../../promotions/service')
  const { spread } = await import('../../promotions/rules')
  const accountId = rel(primary.account)
  const promo = await findDiscount(payload, accountId, [{ target: { kind: 'program', programId: program.id, programType: program.type }, amount: full }])
  const amount = Math.round((full - (promo?.off ?? 0)) * 100) / 100
  const shares = spread(promo?.off ?? 0, quotes.map((q) => q.quote.total))
  const booking = await payload.create({
    collection: 'bookings',
    overrideAccess: true,
    data: {
      reference,
      program: program.id,
      status: 'pending',
      payee,
      amount,
      discount: promo?.off,
      promotion: promo?.promotion,
      birthYear: primary.playingBirthYear ?? primary.birthYear ?? undefined,
      account: rel(primary.account) ?? undefined,
      participant: rel(primary.participant) ?? undefined,
      academyRegistration: primary.id,
      contact: primary.contact,
      player: { ...primary.player, teamName: undefined },
    },
  })
  for (const [n, q] of quotes.entries()) {
    const other = quotes[1 - n]
    await payload.update({
      collection: 'academy-registrations',
      id: q.reg.id,
      overrideAccess: true,
      data: { status: 'pending_payment', slot: q.slot.id, booking: booking.id, amount: Math.round((q.quote.total - shares[n]) * 100) / 100, nights: String(nights) as '1' | '2', pairedWith: nights === 2 ? other.reg.id : null },
    })
  }
  if (promo && accountId) await recordUse(payload, { applied: promo, account: accountId, kind: 'program', reference, paidAmount: amount })
  if (!amount) {
    await confirmPayment(payload, 'booking', reference)
    return `/checkout/success?kind=booking&ref=${reference}`
  }
  const who = `${primary.player.firstName} ${primary.player.lastName}`
  const note = program.type === 'academy-term' ? ` · ${await feeNote(payload)}` : ''
  try {
    const checkout = await startCheckout({
      payee,
      kind: 'booking',
      reference,
      email: primary.contact.email,
      items: perTerm
        ? [{ name: program.title, description: `${who} · ${quotes.map((q) => slotLabel(q.slot)).join(' + ')} · ${perTerm.left} session${perTerm.left === 1 ? '' : 's'}${perTerm.proRata ? ` (pro-rata: ${perTerm.left} of ${perTerm.all})` : ''}${note}`, unitAmount: full, quantity: 1 }]
        : quotes.map((q) =>
        q.quote.perSession !== null
          ? { name: `${program.title} — ${slotLabel(q.slot)}`, description: `${who} · ${q.quote.count} sessions${nights === 2 ? ' (2 nights a week)' : ''}${note}`, unitAmount: q.quote.perSession, quantity: q.quote.count }
          : { name: program.title, description: `${who} · ${slotLabel(q.slot)}`, unitAmount: q.quote.total, quantity: 1 },
      ),
      discount: promo ? { amount: promo.off, label: promo.label } : null,
      cancelPath,
    })
    if (checkout.sessionId) await payload.update({ collection: 'bookings', id: booking.id, overrideAccess: true, data: { stripeCheckoutId: checkout.sessionId } })
    return checkout.url
  } catch (e) {
    await payload.update({ collection: 'bookings', id: booking.id, overrideAccess: true, data: { status: 'cancelled' } })
    throw e
  }
}

/** One night (offers and single bookings). */
export const checkoutRegistration = (payload: Payload, reg: AcademyRegistration, program: Program, slot: AcademyTermSlot, cancelPath: string) =>
  checkoutRegistrations(payload, [{ reg, slot }], program, cancelPath)

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
  const html = emailLayout(brandOf(program), [
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
  await sendEmail(payload, { to: reg.contact.email, subject: `Interest registered: ${program.title}`, html, sender: brandOf(program), userId: rel(reg.account) ?? undefined })
  const staff = emailLayout(brandOf(program), [
    {
      heading: 'New term interest',
      intro: `${esc(reg.player.firstName)} ${esc(reg.player.lastName)} (${esc(by)}) registered interest in ${esc(program.title)} — ${reason === 'full' ? 'their training times are full' : 'no training time for their age group'}. Offer a place from Management → Academy terms.`,
      rows: [
        ['Parent', `${reg.contact.firstName} ${reg.contact.lastName}`],
        ['Email', reg.contact.email],
        ['Mobile', reg.contact.phone],
      ],
      cta: { label: 'Open Academy terms', href: `${siteUrl()}/management/academy/terms?program=${program.id}` },
    },
  ])
  await sendEmail(payload, { to: brandOf(program) === 'club' ? clubBrand.email : academyBrand.email, subject: `Term interest: ${reg.player.firstName} ${reg.player.lastName} (${by})`, html: staff, sender: brandOf(program) })
}

export const termPayUrl = (reg: Pick<AcademyRegistration, 'reference' | 'token'>) => `${siteUrl()}/academy/terms/pay/${reg.reference}${reg.token ? `?t=${reg.token}` : ''}`

/**
 * Staff offer a place (from interest, or a different time): one night, or two nights a week at the 2-night
 * rate (the second night becomes a paired registration paid with the first). Email + SMS with the pay link.
 */
export async function offerSlot(payload: Payload, regId: number, slotIds: number | number[], o: { actorId: number; holdDays?: number }) {
  const ids = (Array.isArray(slotIds) ? slotIds : [slotIds]).filter(Boolean)
  if (ids.length < 1 || ids.length > 2 || new Set(ids).size !== ids.length) throw new Error('Choose one training time, or two different ones for 2 nights a week.')
  const reg = await payload.findByID({ collection: 'academy-registrations', id: regId, depth: 0, overrideAccess: true, showHiddenFields: true })
  if (reg.status === 'paid' || reg.status === 'cancelled') throw new Error('This registration is already paid or cancelled.')
  const program = await payload.findByID({ collection: 'programs', id: rel(reg.program)!, depth: 0, overrideAccess: true })
  const nights = ids.length as 1 | 2
  if (nights === 2 && program.twoNightPricePerSession == null) throw new Error('This program doesn’t offer 2 nights a week (set a 2-night price first).')
  const slots = await Promise.all(ids.map((id) => payload.findByID({ collection: 'academy-term-slots', id, depth: 0, overrideAccess: true })))
  if (slots.some((s) => rel(s.program) !== program.id)) throw new Error('That training time belongs to another program.')
  const rate = nightRate(program, nights)
  slots.sort((a, b) => (termQuote(a, program, rate).sessions[0]?.startsAt ?? 'z').localeCompare(termQuote(b, program, rate).sessions[0]?.startsAt ?? 'z'))
  const now = new Date()
  const until = new Date(now.getTime() + (o.holdDays ?? OFFER_HOLD_DAYS) * DAY)
  const offer = { status: 'offered' as const, offeredAt: now.toISOString(), offerExpiresAt: until.toISOString(), nights: String(nights) as '1' | '2' }
  const pairId = rel(reg.pairedWith as never)
  const pair = pairId ? await payload.findByID({ collection: 'academy-registrations', id: pairId, depth: 0, overrideAccess: true, disableErrors: true }) : null

  let second: AcademyRegistration | null = null
  if (nights === 2) {
    const data = { ...offer, program: program.id, slot: slots[1].id, pairedWith: reg.id, amount: termQuote(slots[1], program, rate, until).total, contact: reg.contact, player: reg.player, account: rel(reg.account), participant: rel(reg.participant), playingBirthYear: reg.playingBirthYear }
    second = pair && pair.status !== 'paid' && pair.status !== 'cancelled'
      ? await payload.update({ collection: 'academy-registrations', id: pair.id, overrideAccess: true, data })
      : await payload.create({ collection: 'academy-registrations', overrideAccess: true, data })
  } else if (pair && pair.status !== 'paid' && pair.status !== 'cancelled') {
    // Back to one night: the other night's offer is withdrawn
    await payload.update({ collection: 'academy-registrations', id: pair.id, overrideAccess: true, data: { status: 'cancelled', pairedWith: null, notes: 'Offer changed to 1 night a week' } })
  }
  const updated = await payload.update({
    collection: 'academy-registrations',
    id: reg.id,
    overrideAccess: true,
    showHiddenFields: true,
    data: { ...offer, slot: slots[0].id, pairedWith: second?.id ?? null, amount: termQuote(slots[0], program, rate, until).total },
  })

  const url = termPayUrl(updated)
  const due = formatDate(until.toISOString(), { weekday: 'long', day: 'numeric', month: 'long' })
  const quotes = slots.map((sl) => termQuote(sl, program, rate))
  const total = quotes.reduce((n, q) => n + q.total, 0)
  const nightRows = slots.flatMap((sl, i) => slotRows(sl, program).map(([k, v]) => [nights === 2 && k === 'Training' ? `Night ${i + 1}` : k, v] as [string, string]).filter(([k]) => i === 0 || k !== 'Age groups'))
  const html = emailLayout(brandOf(program), [
    {
      heading: 'A place is ready',
      intro: `Hi ${esc(reg.contact.firstName)}, we have a place for ${esc(reg.player.firstName)} in <strong>${esc(program.title)}</strong>${nights === 2 ? ' — <strong>2 nights a week</strong>' : ''}. Please confirm and pay by <strong>${esc(due)}</strong> to secure it.`,
      rows: [
        ['Player', `${reg.player.firstName} ${reg.player.lastName}`],
        ...nightRows,
        ['Price', `${nights === 2 ? `${quotes.map(quoteLabel).join(' + ')} = ${formatAUD(total)}` : quoteLabel(quotes[0])} if you pay today`],
        ['Confirm by', due],
      ],
      cta: { label: 'Confirm and pay', href: url },
      after: 'If this doesn’t suit, just reply to this email and we’ll see what else we can do.',
    },
  ])
  const user = reg.account ? ((await payload.findByID({ collection: 'users', id: rel(reg.account)!, depth: 0, overrideAccess: true, disableErrors: true })) as User | null) : null
  await sendEmail(payload, { to: reg.contact.email, subject: `A place for ${reg.player.firstName}: ${program.title}`, html, sender: brandOf(program), userId: user?.id })
  await sendSms(payload, {
    to: reg.contact.phone,
    kind: 'service',
    optedOut: user?.smsOptOut,
    userId: user?.id,
    body: `A place is ready for ${reg.player.firstName} in ${program.title} (${slots.map(slotLabel).join(' + ')}). Confirm and pay by ${due}: ${url} ${brandOf(program) === 'club' ? '– Rowville Eagles FC' : '– Foundation Academy'}`,
  })
  return updated
}

/** Called from onBookingPaid when the booking pays for a term registration. */
export async function markTermRegistrationPaid(payload: Payload, booking: Booking) {
  const id = rel(booking.academyRegistration)
  if (!id) return null
  const data = { status: 'paid' as const, paidAt: new Date().toISOString(), booking: booking.id, account: rel(booking.account), participant: rel(booking.participant) }
  const primary = await payload.update({ collection: 'academy-registrations', id, overrideAccess: true, data })
  // 2 nights a week: the other night is paid by the same booking
  const other = rel(primary.pairedWith as never)
  const second = other ? await payload.update({ collection: 'academy-registrations', id: other, overrideAccess: true, data }) : null
  // Full year: every term's registration is paid by this one booking
  await payload.update({ collection: 'academy-registrations', where: { booking: { equals: booking.id }, status: { equals: 'pending_payment' } }, overrideAccess: true, data })
  return { ...primary, second }
}
