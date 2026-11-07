'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { birthYearOf } from '@/lib/age-groups'
import { checkoutRegistration, emailInterest, existingRegistration, programSlots, slotTaken } from '@/academy/terms/service'
import { slotChoice } from '@/academy/terms/slots'

export type TermState = { error?: string; interest?: { reference: string; reason: 'no_slot' | 'full'; email: string }; values?: Record<string, string> }

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

/**
 * Academy term booking: the player's year of birth picks the training time. One fits → that one;
 * several → the parent's choice; none (or all full) → interest only, nothing charged.
 */
export async function bookTerm(_prev: TermState, fd: FormData): Promise<TermState> {
  const values = Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, String(v)]))
  const fail = (error: string): TermState => ({ error, values })
  const p = await payload()
  const { docs } = await p.find({ collection: 'programs', where: { slug: { equals: str(fd, 'program') }, type: { equals: 'academy-term' }, status: { equals: 'open' } }, limit: 1, depth: 0 })
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
  const choice = slotChoice(slots, birthYear, taken)
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
    const reg = await p.create({ collection: 'academy-registrations', overrideAccess: true, data: { program: program.id, status: 'interest', contact, player, account: accountId } })
    await emailInterest(p, reg, program, choice.reason)
    return { interest: { reference: reg.reference ?? '', reason: choice.reason, email: contact.email } }
  }

  const slot = choice.mode === 'auto' ? choice.slots[0] : choice.slots.find((s) => s.id === Number(str(fd, 'slot')))
  if (!slot) {
    // Their pick filled up while they were on the page, or none was chosen
    return fail(Number(str(fd, 'slot')) ? 'Sorry, that training time just filled up — please choose another.' : 'Please choose a training time.')
  }

  const reg = existing
    ? await p.update({ collection: 'academy-registrations', id: existing.id, overrideAccess: true, showHiddenFields: true, data: { contact, player, account: accountId ?? existing.account } })
    : await p.create({ collection: 'academy-registrations', overrideAccess: true, showHiddenFields: true, data: { program: program.id, status: 'pending_payment', slot: slot.id, contact, player, account: accountId } })
  let url: string
  try {
    url = await checkoutRegistration(p, reg, program, slot, `/programs/${program.slug}/book?cancelled=1`)
  } catch (e) {
    p.logger.error(e)
    return fail('We couldn’t start the payment. Please try again, or contact us if this keeps happening.')
  }
  redirect(url)
}
