'use server'

import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { ageGroupFor, currentSeason } from '@/lib/age'
import { confirmPayment, newReference, startCheckout } from '@/lib/payments'
import { currentAcademyTerm, trialNights } from '@/lib/rfa-trials'

export type RfaTrialState = { error?: string; values?: Record<string, string> }

export async function bookRfaTrial(_prev: RfaTrialState, fd: FormData): Promise<RfaTrialState> {
  const values = Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, String(v)]))
  const fail = (error: string): RfaTrialState => ({ error, values })
  const s = (k: string) => (values[k] ?? '').trim()

  const contact = { firstName: s('contactFirstName'), lastName: s('contactLastName'), email: s('contactEmail').toLowerCase(), phone: s('contactPhone') }
  const player = {
    firstName: s('playerFirstName'),
    lastName: s('playerLastName'),
    dateOfBirth: s('playerDob'),
    medical: s('medical') || undefined,
    emergencyName: s('emergencyName'),
    emergencyPhone: s('emergencyPhone'),
    photoConsent: fd.get('photoConsent') === 'on',
  }
  if (!player.firstName || !player.lastName || !player.dateOfBirth) return fail('Please complete the player’s details.')
  if (!contact.firstName || !contact.lastName || !contact.phone || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) return fail('Please complete your contact details.')
  if (!player.emergencyName || !player.emergencyPhone) return fail('Please add an emergency contact.')
  if (fd.get('terms') !== 'on') return fail('Please accept the terms to continue.')

  const p = await payload()
  const term = await currentAcademyTerm(p)
  if (!term) return fail('There are no Academy trials available right now.')
  const settings = await p.findGlobal({ slug: 'site-settings', depth: 0 })
  const ageGroup = ageGroupFor(player.dateOfBirth, currentSeason(settings.season))
  if (!ageGroup) return fail('Please check the date of birth.')

  const night = (await trialNights(p, term)).find((n) => n.start === s('night'))
  if (!night || !night.ageGroups.includes(ageGroup)) return fail(`Please choose a night that runs for ${ageGroup}.`)
  if ((night.remaining[ageGroup] ?? 0) <= 0) return fail('Sorry — that night’s trial spots for this age group were just taken. Please choose another.')

  const price = term.trialPrice ?? 0
  const reference = newReference('academy')
  const booking = await p.create({
    collection: 'bookings',
    overrideAccess: true,
    data: { reference, program: term.id, bookingType: 'trial', ageGroup, sessionStart: night.start, status: 'pending', payee: 'academy', amount: price, contact, player },
  })

  let url = `/checkout/success?kind=booking&ref=${reference}`
  if (price === 0) {
    await confirmPayment(p, 'booking', reference)
  } else {
    try {
      const checkout = await startCheckout({
        payee: 'academy',
        kind: 'booking',
        reference,
        email: contact.email,
        items: [{ name: `RFA trial — ${term.title}`, description: `${player.firstName} ${player.lastName} · ${night.label}`, unitAmount: price, quantity: 1 }],
        cancelPath: '/academy/trial?cancelled=1',
      })
      if (checkout.sessionId) await p.update({ collection: 'bookings', id: booking.id, data: { stripeCheckoutId: checkout.sessionId }, overrideAccess: true })
      url = checkout.url
    } catch (e) {
      await p.update({ collection: 'bookings', id: booking.id, data: { status: 'cancelled' }, overrideAccess: true })
      p.logger.error(e)
      return fail('We couldn’t start the payment. Please try again shortly.')
    }
  }
  redirect(url)
}
