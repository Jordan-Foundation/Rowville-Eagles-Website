'use server'

import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { makeReference } from '@/lib/reference'
import { startCheckout } from '@/lib/payments'
import { paymentsMode } from '@/lib/stripe-accounts'
import { isCasualOpen } from '@/academy/slots'
import { createHold, holdMinutesFor, loadTermBookingData, releaseExpiredHolds } from '@/academy/booking-data'
import { formatDate } from '@/lib/format'

export type BookState = { error?: string; values?: Record<string, string> }

const MOBILE = /^(\+?61|0)4\d{8}$/

export async function bookCasual(_prev: BookState, fd: FormData): Promise<BookState> {
  const values = Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, String(v)]))
  const fail = (error: string): BookState => ({ error, values })
  const s = (k: string) => (values[k] ?? '').trim()

  const p = await payload()
  const user = await currentUser()
  await releaseExpiredHolds(p)

  // Slot — recheck on the server; never trust the page
  const coachId = Number(s('coach'))
  const startsAt = s('start')
  const termId = Number(s('term'))
  const term = termId ? await p.findByID({ collection: 'academy-terms', id: termId, depth: 0, disableErrors: true }) : null
  if (!term || term.status !== 'open' || !coachId || Number.isNaN(Date.parse(startsAt))) return fail('This session isn’t available any more.')
  const data = await loadTermBookingData(p, term)
  if (!isCasualOpen({ term, coaches: data.availability, taken: data.taken, now: new Date(), cutoffHours: term.bookingCutoffHours ?? 24, coachId, startsAt })) {
    return fail('Sorry — that time has just been booked. Please choose another.')
  }

  // Parent / guardian
  const contact = user
    ? { firstName: user.firstName || s('contactFirstName'), lastName: user.lastName || s('contactLastName'), email: user.email, mobile: (user.phone || s('contactMobile')).replace(/\s+/g, '') }
    : { firstName: s('contactFirstName'), lastName: s('contactLastName'), email: s('contactEmail').toLowerCase(), mobile: s('contactMobile').replace(/\s+/g, '') }
  if (!contact.firstName || !contact.lastName) return fail('Please enter the parent or guardian’s name.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) return fail('Please enter a valid email address.')
  if (!MOBILE.test(contact.mobile)) return fail('Please enter an Australian mobile number, e.g. 0412 345 678.')

  // Player — an existing player on the account, or new details
  let participantId: number | undefined
  let player = { firstName: s('playerFirstName'), lastName: s('playerLastName'), dateOfBirth: s('playerDob') }
  if (user && s('participant') && s('participant') !== 'new') {
    const kid = await p.findByID({ collection: 'participants', id: Number(s('participant')), depth: 0, overrideAccess: true, disableErrors: true })
    if (!kid || (typeof kid.account === 'object' ? kid.account.id : kid.account) !== user.id) return fail('Please choose a player on your account.')
    participantId = kid.id
    player = { firstName: kid.firstName, lastName: kid.lastName, dateOfBirth: kid.dateOfBirth }
  }
  if (!player.firstName || !player.lastName || !player.dateOfBirth || Number.isNaN(Date.parse(player.dateOfBirth))) return fail('Please enter the player’s name and date of birth.')
  if (!s('emergencyName') || !s('emergencyPhone')) return fail('Please add an emergency contact.')
  if (fd.get('terms') !== 'on') return fail('Please accept the terms to continue.')

  try {
    paymentsMode('academy')
  } catch {
    return fail('Online payments aren’t set up yet — please contact the Academy to book.')
  }

  const coach = await p.findByID({ collection: 'academy-coaches', id: coachId, depth: 0 })
  const reference = makeReference('RFA')
  const holdMinutes = holdMinutesFor(term)
  const hold = await createHold(p, {
    reference,
    type: 'casual',
    paymentMode: 'casual',
    amount: term.casualPrice, // server price, never from the browser
    sessionsTotal: 1,
    sessionsPaid: 0,
    coach: coachId,
    term: term.id,
    firstSessionAt: startsAt,
    contact,
    player: {
      ...player,
      currentClub: s('currentClub') || undefined,
      position: s('position') || undefined,
      goals: s('goals') || undefined,
      medical: s('medical') || undefined,
      emergencyName: s('emergencyName'),
      emergencyPhone: s('emergencyPhone'),
      photoConsent: fd.get('photoConsent') === 'on',
    },
    account: user?.id,
    participant: participantId,
    marketingOptIn: !user && fd.get('marketingOptIn') === 'on',
    source: 'web',
    sessionStarts: [new Date(startsAt).toISOString()],
    holdMinutes,
  })
  if (!hold.ok) return fail('Sorry — someone booked that time a moment ago. Please choose another.')

  let url: string
  try {
    const checkout = await startCheckout({
      payee: 'academy',
      kind: 'academy',
      reference,
      email: contact.email,
      items: [{ name: `1-on-1 with ${coach.displayName}`, description: `${player.firstName} ${player.lastName} · ${formatDate(startsAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`, unitAmount: term.casualPrice, quantity: 1 }],
      cancelPath: `/academy/1-on-1/book?coach=${coachId}&start=${encodeURIComponent(startsAt)}&cancelled=${reference}`,
      successPath: '/academy/1-on-1/booked',
      expiresInMinutes: holdMinutes,
    })
    if (checkout.sessionId) await p.update({ collection: 'academy-bookings', id: hold.booking.id, data: { stripeCheckoutId: checkout.sessionId }, overrideAccess: true })
    url = checkout.url
  } catch (e) {
    p.logger.error(e)
    const { releaseAcademyHold } = await import('@/academy/booking-data')
    await releaseAcademyHold(p, reference)
    return fail('We couldn’t start the payment. Please try again shortly.')
  }
  redirect(url)
}
