'use server'

import { rateLimit } from '@/lib/form-guard'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { birthYearOf } from '@/lib/age-groups'
import { confirmPayment, newReference } from '@/lib/payments'
import { toddlerAgeOk } from '@/academy/terms/toddler'
import { toddlerTrialSessions } from '@/academy/terms/toddler-data'

export type ToddlerTrialState = { error?: string; values?: Record<string, string> }

/** One free Mini Ballers trial per child (matched on name + date of birth), within each session's trial places. */
export async function bookToddlerTrial(_prev: ToddlerTrialState, fd: FormData): Promise<ToddlerTrialState> {
  const values = Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, String(v).slice(0, 2000)]))
  const fail = (error: string): ToddlerTrialState => ({ error, values })
  const s = (k: string) => (values[k] ?? '').trim()
  const contact = { firstName: s('contactFirstName'), lastName: s('contactLastName'), email: s('contactEmail').toLowerCase(), phone: s('contactPhone') }
  const player = { firstName: s('playerFirstName'), lastName: s('playerLastName'), dateOfBirth: s('playerDob'), medical: s('medical') || undefined, emergencyName: s('emergencyName'), emergencyPhone: s('emergencyPhone'), photoConsent: fd.get('photoConsent') === 'on' }
  if (!player.firstName || !player.lastName || !player.dateOfBirth || Number.isNaN(Date.parse(player.dateOfBirth))) return fail('Please complete your child’s details.')
  if (!contact.firstName || !contact.lastName || !contact.phone || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) return fail('Please complete your contact details.')
  if (!player.emergencyName || !player.emergencyPhone) return fail('Please add an emergency contact.')
  if (fd.get('terms') !== 'on') return fail('Please accept the terms to continue.')

  const p = await payload()
  const limited = await rateLimit(p, 'toddler-trial', { email: contact.email })
  if (limited) return fail(limited)
  const { docs } = await p.find({ collection: 'programs', where: { slug: { equals: s('program') }, type: { equals: 'toddler' }, status: { in: ['open', 'full'] } }, limit: 1, depth: 0 })
  const program = docs[0]
  if (!program) return fail('Mini Ballers trials aren’t available right now.')
  const session = (await toddlerTrialSessions(p, program)).find((x) => x.start === s('session'))
  if (!session) return fail('Please choose a session.')
  const age = toddlerAgeOk(player.dateOfBirth, session.start)
  if (!age.ok) return fail(age.reason)
  if (session.left <= 0) return fail('Sorry — that session’s trial places were just taken. Please choose another.')

  const norm = (x: string | null | undefined) => (x ?? '').trim().toLowerCase()
  const { docs: prior } = await p.find({
    collection: 'bookings',
    where: { program: { equals: program.id }, bookingType: { equals: 'trial' }, 'player.firstName': { like: player.firstName }, status: { in: ['paid', 'pending'] } },
    limit: 50,
    depth: 0,
    overrideAccess: true,
    select: { player: true, sessionStart: true },
  })
  if (prior.some((b) => norm(b.player?.firstName) === norm(player.firstName) && norm(b.player?.lastName) === norm(player.lastName) && (b.player?.dateOfBirth ?? '').slice(0, 10) === player.dateOfBirth.slice(0, 10))) {
    return fail(`${player.firstName} has already had a free trial. To keep coming, book the term from the Mini Ballers page.`)
  }

  const payee = program.payee === 'academy' ? 'academy' : 'club'
  const reference = newReference(payee)
  await p.create({
    collection: 'bookings',
    overrideAccess: true,
    data: { reference, program: program.id, bookingType: 'trial', birthYear: birthYearOf(player.dateOfBirth) ?? undefined, sessionStart: session.start, status: 'pending', payee, amount: 0, contact, player },
  })
  await confirmPayment(p, 'booking', reference)
  redirect(`/checkout/success?kind=booking&ref=${reference}`)
}
