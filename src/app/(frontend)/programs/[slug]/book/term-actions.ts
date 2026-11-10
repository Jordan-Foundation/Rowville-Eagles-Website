'use server'

import { rateLimit } from '@/lib/form-guard'
import { rememberKid } from '@/lib/family-kids'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { birthYearOf } from '@/lib/age-groups'
import { checkoutRegistrations, emailInterest, existingRegistration, nightRate, programSlots, slotTaken, TermClosedError } from '@/academy/terms/service'
import { slotChoice, termQuote } from '@/academy/terms/slots'
import { toddlerAgeOk } from '@/academy/terms/toddler'
import { isPerTerm } from '@/academy/terms/pricing'

export type TermState = { error?: string; interest?: { reference: string; reason: 'no_slot' | 'full'; email: string }; values?: Record<string, string> }

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim().slice(0, 2000)
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

/**
 * Academy term booking: the player's year of birth picks the training time. One fits → that one;
 * several → the parent's choice; none (or all full) → interest only, nothing charged.
 */
export async function bookTerm(_prev: TermState, fd: FormData): Promise<TermState> {
  const values = Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, String(v).slice(0, 2000)]))
  const fail = (error: string): TermState => ({ error, values })
  const p = await payload()
  const limited = await rateLimit(p, 'term-booking', { perIp: 20 })
  if (limited) return fail(limited)
  const { docs } = await p.find({ pagination: false, collection: 'programs', where: { slug: { equals: str(fd, 'program') }, type: { in: ['academy-term', 'toddler'] }, status: { equals: 'open' } }, limit: 1, depth: 0 })
  const program = docs[0]
  if (!program) return fail('This program is no longer taking registrations.')

  const contact = { firstName: str(fd, 'contactFirstName'), lastName: str(fd, 'contactLastName'), email: str(fd, 'contactEmail').toLowerCase(), phone: str(fd, 'contactPhone') }
  if (!contact.firstName || !contact.lastName || !contact.phone) return fail('Please complete your contact details.')
  if (!emailOk(contact.email)) return fail('Please enter a valid email address.')
  const player = {
    firstName: str(fd, 'playerFirstName'),
    lastName: str(fd, 'playerLastName'),
    dateOfBirth: str(fd, 'playerDob'),
    medical: str(fd, 'medical') || undefined,
    emergencyName: str(fd, 'emergencyName'),
    emergencyPhone: str(fd, 'emergencyPhone'),
    photoConsent: fd.get('photoConsent') === 'on',
  }
  if (!player.firstName || !player.lastName || !player.dateOfBirth || Number.isNaN(Date.parse(player.dateOfBirth))) return fail('Please complete the player’s name and date of birth.')
  if (!player.emergencyName || !player.emergencyPhone) return fail('Please add an emergency contact.')
  if (fd.get('terms') !== 'on') return fail('Please accept the terms to continue.')
  const birthYear = birthYearOf(player.dateOfBirth)!

  const { user } = await p.auth({ headers: await headers() })
  const accountId = user?.collection === 'users' ? user.id : undefined

  const [slots, taken] = await Promise.all([programSlots(p, program.id), slotTaken(p, program.id)])
  const choice = slotChoice(slots, birthYear, taken, (s) => termQuote(s, program, program).bookable)
  // Mini Ballers: aged 2–5 on the day of their first session (from the date of birth, not the MiniRoos age groups)
  if (program.type === 'toddler') {
    const firstSession = (choice.slots.length ? termQuote(choice.slots.find((x) => x.id === Number(str(fd, 'slot'))) ?? choice.slots[0], program, program).sessions[0]?.startsAt : null) ?? program.startDate ?? new Date().toISOString()
    const age = toddlerAgeOk(player.dateOfBirth, firstSession)
    if (!age.ok) return fail(age.reason)
  }
  // Logged-in family: keep this child and their medical / emergency details on the account for next time
  const kidId = accountId
    ? await rememberKid(p, accountId, { participantId: Number(str(fd, 'participant')) || null, firstName: player.firstName, lastName: player.lastName, dateOfBirth: player.dateOfBirth, medical: player.medical ?? undefined, emergencyName: player.emergencyName, emergencyPhone: player.emergencyPhone, photoConsent: player.photoConsent })
    : null
  const existing = await existingRegistration(p, program.id, player)
  if (existing && existing.status === 'paid') return fail(`${player.firstName} is already registered for this term. Check your account for the details.`)
  if (existing && (existing.status === 'interest' || existing.status === 'offered')) {
    return fail(
      existing.status === 'offered'
        ? `We’ve already offered ${player.firstName} a place — use the link in your email to confirm and pay.`
        : `${player.firstName}’s interest is already registered. We’ll email you when a place is available.`,
    )
  }

  if (choice.mode === 'interest') {
    const reg = await p.create({ collection: 'academy-registrations', overrideAccess: true, data: { program: program.id, status: 'interest', contact, player, account: accountId, participant: kidId ?? undefined } })
    await emailInterest(p, reg, program, choice.reason)
    return { interest: { reference: reg.reference ?? '', reason: choice.reason, email: contact.email } }
  }

  // 1 night: one time (picked for them if only one fits). 2 nights: two times at the 2-night rate.
  // Per-term pricing (Terms 1 and 4) is 2 sessions a week: two training times whenever the age group has them
  const perTerm = isPerTerm(program)
  const openAny = slotChoice(slots, birthYear, taken, (s) => termQuote(s, program, program).bookable).slots
  const twoNights = perTerm ? openAny.length >= 2 : program.type === 'academy-term' && str(fd, 'nights') === '2' && program.twoNightPricePerSession != null
  const open = slotChoice(slots, birthYear, taken, (s) => termQuote(s, program, nightRate(program, twoNights ? 2 : 1)).bookable).slots
  let picked: typeof open
  if (twoNights) {
    const want = fd.getAll('slots').map(Number)
    picked = open.length === 2 ? open : open.filter((s) => want.includes(s.id))
    if (open.length < 2) return fail('There aren’t two training times with space for this age group — please choose 1 night a week.')
    if (picked.length !== 2) return fail('Choose two training times.')
  } else {
    const one = choice.mode === 'auto' ? choice.slots[0] : choice.slots.find((s) => s.id === Number(str(fd, 'slot')))
    if (!one) return fail(Number(str(fd, 'slot')) ? 'Sorry, that training time just filled up — please choose another.' : 'Please choose a training time.')
    picked = [one]
  }

  // Nights in week order (first session first)
  picked = [...picked].sort((a, b) => (termQuote(a, program, program).sessions[0]?.startsAt ?? '').localeCompare(termQuote(b, program, program).sessions[0]?.startsAt ?? ''))
  // A checkout that was started but not finished is replaced by this one
  if (existing?.status === 'pending_payment') {
    for (const id of [existing.id, typeof existing.pairedWith === 'object' ? existing.pairedWith?.id : existing.pairedWith].filter(Boolean) as number[]) {
      await p.update({ collection: 'academy-registrations', id, overrideAccess: true, data: { status: 'cancelled', notes: 'Replaced by a new booking' } })
    }
  }
  const regs = []
  for (const s of picked) {
    regs.push(await p.create({ collection: 'academy-registrations', overrideAccess: true, showHiddenFields: true, data: { program: program.id, status: 'pending_payment', slot: s.id, contact, player, account: accountId, participant: kidId ?? undefined, nights: twoNights ? '2' : '1' } }))
  }
  let url: string
  try {
    url = await checkoutRegistrations(p, regs.map((reg, i) => ({ reg, slot: picked[i] })), program, `/programs/${program.slug}/book?cancelled=1`)
  } catch (e) {
    if (e instanceof TermClosedError) return fail(e.message)
    p.logger.error(e)
    return fail('We couldn’t start the payment. Please try again, or contact us if this keeps happening.')
  }
  redirect(url)
}
