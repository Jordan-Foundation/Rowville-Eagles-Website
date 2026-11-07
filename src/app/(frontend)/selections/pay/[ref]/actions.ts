'use server'

import { redirect } from 'next/navigation'
import { newReference, startCheckout, confirmPayment } from '@/lib/payments'
import { paymentsMode } from '@/lib/stripe-accounts'
import { awaitingPayment } from '@/selections/payment'
import { loadPayable } from './load'

export type PayState = { error?: string; values?: Record<string, string> }

const PHONE = /^(\+?61|0)[2-478]\d{8}$/

export async function payForSelection(_prev: PayState, fd: FormData): Promise<PayState> {
  const values = Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, String(v)]))
  const fail = (error: string): PayState => ({ error, values })
  const s = (k: string) => (values[k] ?? '').trim()
  const data = await loadPayable(s('ref'), s('t'))
  if (!data) return fail('This link isn’t valid any more. Please log in to your account or contact us.')
  const { p, entry, round, program, squad, fee, payee } = data
  if (!awaitingPayment(entry)) return fail(entry.status === 'registered' ? 'This registration is already paid.' : 'This place is no longer available — please contact us.')
  if (!program || !payee) return fail('Registration isn’t set up for this round yet — please contact us.')
  if (!s('emergencyName') || !PHONE.test(s('emergencyPhone').replace(/\s+/g, ''))) return fail('Please add an emergency contact with an Australian phone number.')
  if (fd.get('terms') !== 'on') return fail('Please accept the terms to continue.')
  try {
    paymentsMode(payee)
  } catch {
    return fail('Online payments aren’t set up yet — please contact us to pay.')
  }

  const reference = newReference(payee)
  const booking = await p.create({
    collection: 'bookings',
    overrideAccess: true,
    data: {
      reference,
      program: program.id,
      status: 'pending',
      payee,
      amount: fee,
      bookingType: 'enrolment',
      birthYear: entry.playingBirthYear ?? entry.birthYear,
      account: typeof entry.account === 'object' ? entry.account?.id : entry.account,
      participant: typeof entry.participant === 'object' ? entry.participant?.id : entry.participant,
      selectionEntry: entry.id,
      contact: entry.contact,
      player: {
        firstName: entry.player.firstName,
        lastName: entry.player.lastName,
        dateOfBirth: entry.player.dateOfBirth,
        teamName: squad?.name,
        medical: s('medical') || undefined,
        emergencyName: s('emergencyName'),
        emergencyPhone: s('emergencyPhone').replace(/\s+/g, ''),
        photoConsent: fd.get('photoConsent') === 'on',
      },
    },
  })
  if (fee <= 0) {
    await confirmPayment(p, 'booking', reference)
    redirect(`/checkout/success?kind=booking&ref=${reference}`)
  }
  let url: string
  try {
    const checkout = await startCheckout({
      payee,
      kind: 'booking',
      reference,
      email: entry.contact.email,
      items: [{ name: round.kind === 'tournament' ? `${program.title} — ${squad?.name ?? 'registration'}` : program.title, description: `${entry.player.firstName} ${entry.player.lastName}`, unitAmount: fee, quantity: 1 }],
      cancelPath: `/selections/pay/${entry.reference}${s('t') ? `?t=${s('t')}` : ''}`,
    })
    if (checkout.sessionId) await p.update({ collection: 'bookings', id: booking.id, data: { stripeCheckoutId: checkout.sessionId }, overrideAccess: true })
    url = checkout.url
  } catch (e) {
    p.logger.error(e)
    await p.update({ collection: 'bookings', id: booking.id, data: { status: 'cancelled' }, overrideAccess: true })
    return fail('We couldn’t start the payment. Please try again shortly.')
  }
  redirect(url)
}
