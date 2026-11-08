'use server'

import { rateLimit } from '@/lib/form-guard'
import { dobProblem, phoneOk } from '@/lib/validate'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { findDiscount, recordUse } from '@/promotions/service'
import { payload } from '@/lib/payload'
import { birthYearOf, groupLabel } from '@/lib/age-groups'
import { confirmPayment, newReference, startCheckout } from '@/lib/payments'
import { currentAcademyTerm, trialNights } from '@/lib/rfa-trials'

export type RfaTrialState = { error?: string; values?: Record<string, string> }

export async function bookRfaTrial(_prev: RfaTrialState, fd: FormData): Promise<RfaTrialState> {
  const values = Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, String(v).slice(0, 2000)]))
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
  if (dobProblem(player.dateOfBirth)) return fail(dobProblem(player.dateOfBirth)!)
  if (!phoneOk(contact.phone) || !phoneOk(player.emergencyPhone)) return fail('Please enter Australian phone numbers, e.g. 0412 345 678.')
  if (fd.get('terms') !== 'on') return fail('Please accept the terms to continue.')

  const p = await payload()
  const limited = await rateLimit(p, 'rfa-trial', { email: contact.email })
  if (limited) return fail(limited)
  const term = await currentAcademyTerm(p)
  if (!term) return fail('There are no Academy trials available right now.')
  const birthYear = birthYearOf(player.dateOfBirth)
  if (!birthYear) return fail('Please check the date of birth.')

  // One trial per player, ever (matched on name + date of birth)
  const { docs: prior } = await p.find({
    collection: 'bookings',
    where: {
      bookingType: { equals: 'trial' },
      'player.firstName': { like: player.firstName },
      'player.lastName': { like: player.lastName },
      or: [{ status: { equals: 'paid' } }, { and: [{ status: { equals: 'pending' } }, { createdAt: { greater_than: new Date(Date.now() - 35 * 60_000).toISOString() } }] }],
    },
    limit: 50,
    depth: 0,
    overrideAccess: true,
    select: { player: true, sessionStart: true },
  })
  const norm = (x: string | null | undefined) => (x ?? '').trim().toLowerCase()
  const already = prior.find((b) => norm(b.player?.firstName) === norm(player.firstName) && norm(b.player?.lastName) === norm(player.lastName) && (b.player?.dateOfBirth ?? '').slice(0, 10) === player.dateOfBirth.slice(0, 10))
  if (already) return fail(`${player.firstName} has already booked a trial session${already.sessionStart ? ` (${new Date(already.sessionStart).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Australia/Sydney' })})` : ''}. Each player can have one trial — to join the academy, choose a training time on the Academy page.`)

  const night = (await trialNights(p, term)).find((n) => n.start === s('night'))
  if (!night || !night.birthYears.includes(birthYear)) return fail(`Please choose a night that runs for ${groupLabel(birthYear)}.`)
  if ((night.remaining[String(birthYear)] ?? 0) <= 0) return fail('Sorry — that night’s trial spots for this age group were just taken. Please choose another.')

  const price = term.trialPrice ?? 0
  const reference = newReference('academy')
  const { user } = await p.auth({ headers: await headers() })
  const accountId = user?.collection === 'users' ? user.id : undefined
  const promo = await findDiscount(p, accountId, [{ target: { kind: 'program', programId: term.id, programType: 'academy-trial' }, amount: price }])
  const due = Math.round((price - (promo?.off ?? 0)) * 100) / 100
  const booking = await p.create({
    collection: 'bookings',
    overrideAccess: true,
    data: { reference, program: term.id, bookingType: 'trial', birthYear, sessionStart: night.start, status: 'pending', payee: 'academy', amount: due, discount: promo?.off, promotion: promo?.promotion, account: accountId, contact, player },
  })
  if (promo && accountId) await recordUse(p, { applied: promo, account: accountId, kind: 'program', reference, paidAmount: due })

  let url = `/checkout/success?kind=booking&ref=${reference}`
  if (due === 0) {
    await confirmPayment(p, 'booking', reference)
  } else {
    try {
      const checkout = await startCheckout({
        payee: 'academy',
        kind: 'booking',
        reference,
        email: contact.email,
        items: [{ name: `RFA trial — ${term.title}`, description: `${player.firstName} ${player.lastName} · ${night.label}`, unitAmount: price, quantity: 1 }],
        discount: promo ? { amount: promo.off, label: promo.label } : null,
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
