'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { confirmPayment, newReference, placesTaken, startCheckout } from '@/lib/payments'
import { defaultPayee } from '@/collections/Programs'
import { isPayee } from '@/lib/stripe-accounts'

export type BookingState = { error?: string; values?: Record<string, string> }

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim()
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

export async function bookProgram(_prev: BookingState, fd: FormData): Promise<BookingState> {
  const values = Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, String(v)]))
  const fail = (error: string): BookingState => ({ error, values })

  const p = await payload()
  const { docs } = await p.find({
    collection: 'programs',
    where: { slug: { equals: str(fd, 'program') }, status: { equals: 'open' } },
    limit: 1,
    depth: 0,
  })
  const program = docs[0]
  if (!program) return fail('This program is no longer taking bookings.')

  const isTeamEntry = program.type === 'tournament'
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
    firstName: str(fd, 'playerFirstName'),
    lastName: str(fd, 'playerLastName'),
    dateOfBirth: str(fd, 'playerDob') || undefined,
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

  // Link to a logged-in account if there is one; guests are linked later via verified email.
  const { user } = await p.auth({ headers: await headers() })

  const payee = isPayee(program.payee) ? program.payee : defaultPayee(program.type)
  const reference = newReference(payee)
  const booking = await p.create({
    collection: 'bookings',
    data: {
      reference,
      program: program.id,
      status: 'pending',
      payee,
      amount: program.price,
      sessionStart,
      account: user?.collection === 'users' ? user.id : undefined,
      contact,
      player,
    },
  })

  let url: string
  if (program.price === 0) {
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
        items: [{ name: program.title, description: who, unitAmount: program.price, quantity: 1 }],
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
