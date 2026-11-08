'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { confirmPayment, newReference, placesTaken, startCheckout } from '@/lib/payments'
import { defaultPayee } from '@/collections/Programs'
import { isPayee } from '@/lib/stripe-accounts'
import { findDiscount, recordUse } from '@/promotions/service'

export type BookingState = { error?: string; values?: Record<string, string> }

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

export async function bookProgram(_prev: BookingState, fd: FormData): Promise<BookingState> {
  const values = Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, String(v)]))
  const fail = (error: string): BookingState => ({ error, values })

  const p = await payload()
  const { docs } = await p.find({
    collection: 'programs',
    where: { slug: { equals: str(fd, 'program') }, status: { equals: 'open' }, type: { not_in: ['academy-trial', 'community'] } },
    limit: 1,
    depth: 0,
  })
  const program = docs[0]
  if (!program) return fail('This program is no longer taking bookings.')

  if (program.type === 'tournament') return { error: 'Tournaments are by selection — please register interest instead.' }
  const isTeamEntry = false
  const isRegistration = program.type === 'registration'

  // Link to a logged-in account if there is one; guests are linked after payment by email.
  const { user } = await p.auth({ headers: await headers() })
  const accountId = user?.collection === 'users' ? user.id : undefined

  // Team registrations: must be logged in and paying for a player with an offer for THIS program.
  let offeredParticipant: { id: number; firstName: string; lastName: string; dateOfBirth: string } | undefined
  if (isRegistration) {
    if (!accountId) return fail('Please log in to pay registration.')
    const pid = Number(str(fd, 'participant'))
    const kid = pid ? await p.findByID({ collection: 'participants', id: pid, depth: 0, overrideAccess: true, disableErrors: true }) : null
    const offerProgram = kid?.registrationOffer?.program
    const ok =
      kid &&
      (typeof kid.account === 'object' ? kid.account.id : kid.account) === accountId &&
      kid.registrationOffer?.status === 'offered' &&
      (typeof offerProgram === 'object' ? offerProgram?.id : offerProgram) === program.id
    if (!ok) return fail('This registration isn’t available for that player. Check your account for offers.')
    offeredParticipant = { id: kid.id, firstName: kid.firstName, lastName: kid.lastName, dateOfBirth: kid.dateOfBirth }
  }
  const usesSlots = (program.slots?.length ?? 0) > 0

  const contact = {
    firstName: str(fd, 'contactFirstName'),
    lastName: str(fd, 'contactLastName'),
    email: str(fd, 'contactEmail').toLowerCase(),
    phone: str(fd, 'contactPhone'),
  }
  if (!contact.firstName || !contact.lastName || !contact.phone) return fail('Please complete your contact details.')
  if (!emailOk(contact.email)) return fail('Please enter a valid email address.')

  const player = {
    firstName: offeredParticipant?.firstName ?? str(fd, 'playerFirstName'),
    lastName: offeredParticipant?.lastName ?? str(fd, 'playerLastName'),
    dateOfBirth: offeredParticipant?.dateOfBirth ?? (str(fd, 'playerDob') || undefined),
    teamName: str(fd, 'teamName') || undefined,
    medical: str(fd, 'medical') || undefined,
    emergencyName: str(fd, 'emergencyName'),
    emergencyPhone: str(fd, 'emergencyPhone'),
    photoConsent: fd.get('photoConsent') === 'on',
  }
  if (isTeamEntry) {
    if (!player.teamName) return fail('Please enter the team name.')
  } else {
    if (!player.firstName || !player.lastName || !player.dateOfBirth) return fail('Please complete the player’s name and date of birth.')
    if (Number.isNaN(Date.parse(player.dateOfBirth))) return fail('Please enter a valid date of birth.')
    if (!player.emergencyName || !player.emergencyPhone) return fail('Please add an emergency contact.')
  }
  if (fd.get('terms') !== 'on') return fail('Please accept the terms to continue.')

  // Capacity
  let sessionStart: string | undefined
  if (usesSlots) {
    const slot = program.slots!.find((s) => s.start === str(fd, 'slot'))
    if (!slot) return fail('Please choose a time.')
    if (new Date(slot.start) < new Date()) return fail('That time has passed — please choose another.')
    sessionStart = slot.start
    if ((await placesTaken(p, program.id, sessionStart)) >= (slot.capacity ?? 1)) return fail('Sorry, that time was just booked. Please choose another.')
  }
  if (program.capacity && (await placesTaken(p, program.id)) >= program.capacity) return fail('Sorry, this program has just filled up.')

  const payee = isPayee(program.payee) ? program.payee : defaultPayee(program.type)
  const reference = newReference(payee)
  // Promotion for this family (worked out on the server)
  const price = program.price ?? 0
  const promo = await findDiscount(p, accountId, [{ target: { kind: 'program', programId: program.id, programType: program.type }, amount: price }])
  const due = Math.round((price - (promo?.off ?? 0)) * 100) / 100
  const booking = await p.create({
    collection: 'bookings',
    data: {
      reference,
      program: program.id,
      status: 'pending',
      payee,
      amount: due,
      discount: promo?.off,
      promotion: promo?.promotion,
      sessionStart,
      account: accountId,
      participant: offeredParticipant?.id,
      contact,
      player,
    },
  })

  if (promo && accountId) await recordUse(p, { applied: promo, account: accountId, kind: 'program', reference, paidAmount: due })
  let url: string
  if (due === 0) {
    await confirmPayment(p, 'booking', reference)
    url = `/checkout/success?kind=booking&ref=${reference}`
  } else {
    try {
      const who = isTeamEntry ? player.teamName : `${player.firstName} ${player.lastName}`
      const checkout = await startCheckout({
        payee,
        kind: 'booking',
        reference,
        email: contact.email,
        items: [{ name: program.title, description: who, unitAmount: price, quantity: 1 }],
        discount: promo ? { amount: promo.off, label: promo.label } : null,
        cancelPath: `/programs/${program.slug}/book?cancelled=1`,
      })
      if (checkout.sessionId) await p.update({ collection: 'bookings', id: booking.id, data: { stripeCheckoutId: checkout.sessionId } })
      url = checkout.url
    } catch (e) {
      await p.update({ collection: 'bookings', id: booking.id, data: { status: 'cancelled' } })
      p.logger.error(e)
      return fail('We couldn’t start the payment. Please try again, or contact the club if this keeps happening.')
    }
  }
  redirect(url)
}
