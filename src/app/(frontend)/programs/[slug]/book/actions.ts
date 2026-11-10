'use server'

import { rateLimit } from '@/lib/form-guard'
import { dobProblem, phoneOk } from '@/lib/validate'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { campBookings, confirmPayment, newReference, placesTaken, startCheckout } from '@/lib/payments'
import { defaultPayee } from '@/collections/Programs'
import { isPayee } from '@/lib/stripe-accounts'
import { findDiscount, recordUse } from '@/promotions/service'
import { rememberKid } from '@/lib/family-kids'
import { localYmd } from '@/lib/time'
import { campChoiceLabel, campDayLabel, campDayList, campPrices, campQuote, placesByDay } from '@/lib/camps'

export type BookingState = { error?: string; values?: Record<string, string> }

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim().slice(0, 2000)
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

export async function bookProgram(_prev: BookingState, fd: FormData): Promise<BookingState> {
  const values = Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, String(v).slice(0, 2000)]))
  values.campDays = fd.getAll('campDay').map(String).join(',')
  const fail = (error: string): BookingState => ({ error, values })

  const p = await payload()
  const limited = await rateLimit(p, 'program-booking', { perIp: 20 })
  if (limited) return fail(limited)
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
  // Holiday camps: the full camp or chosen days, priced here on the server
  const campDays = program.type === 'holiday-camp' ? campDayList(program) : []
  const isCamp = campDays.length > 0
  const quote = isCamp
    ? campQuote({ allDays: campDays.map((d) => d.date), full: str(fd, 'campOption') === 'full', days: fd.getAll('campDay').map(String), prices: campPrices(program) })
    : null
  if (isCamp && !quote) return fail('Please choose the full camp or at least one day.')
  if (quote) {
    const today = localYmd(new Date())
    if (quote.days.some((d) => d < today)) return fail(quote.fullCamp ? 'This camp has already started — choose from the days left.' : 'One of those days has already happened — please choose again.')
  }

  const contact = {
    firstName: str(fd, 'contactFirstName'),
    lastName: str(fd, 'contactLastName'),
    email: str(fd, 'contactEmail').toLowerCase(),
    phone: str(fd, 'contactPhone'),
  }
  if (!contact.firstName || !contact.lastName || !contact.phone) return fail('Please complete your contact details.')
  if (!emailOk(contact.email)) return fail('Please enter a valid email address.')
  if (!phoneOk(contact.phone)) return fail('Please enter an Australian phone number, e.g. 0412 345 678.')

  // One or more children (brothers and sisters can be booked in the same checkout: fields end _2, _3, _4)
  const suffixes = ['', ...(isRegistration ? [] : ['_2', '_3', '_4'].filter((x) => fd.has(`playerFirstName${x}`) || fd.has(`participant${x}`)))]
  const players = suffixes.map((x) => ({
    suffix: x,
    participantId: x === '' ? offeredParticipant?.id ?? (Number(str(fd, 'participant')) || null) : Number(str(fd, `participant${x}`)) || null,
    firstName: x === '' && offeredParticipant ? offeredParticipant.firstName : str(fd, `playerFirstName${x}`),
    lastName: x === '' && offeredParticipant ? offeredParticipant.lastName : str(fd, `playerLastName${x}`),
    dateOfBirth: x === '' && offeredParticipant ? offeredParticipant.dateOfBirth : str(fd, `playerDob${x}`) || undefined,
    teamName: x === '' ? str(fd, 'teamName') || undefined : undefined,
    medical: str(fd, `medical${x}`) || undefined,
    medicalAnswer: str(fd, `medicalAnswer${x}`),
    emergencyName: str(fd, `emergencyName${x}`),
    emergencyRelationship: str(fd, `emergencyRelationship${x}`) || undefined,
    keepWith: str(fd, `keepWith${x}`).slice(0, 120) || undefined,
    emergencyPhone: str(fd, `emergencyPhone${x}`),
    photoConsent: fd.get(`photoConsent${x}`) === 'on',
  }))
  for (const [i, pl] of players.entries()) {
    const who = players.length > 1 ? ` for child ${i + 1}` : ''
    if (isTeamEntry) {
      if (!pl.teamName) return fail('Please enter the team name.')
      continue
    }
    if (!pl.firstName || !pl.lastName || !pl.dateOfBirth) return fail(`Please complete the player’s name and date of birth${who}.`)
    if (dobProblem(pl.dateOfBirth)) return fail(dobProblem(pl.dateOfBirth)! + (who ? ` (child ${i + 1})` : ''))
    if (!pl.emergencyName || !pl.emergencyPhone) return fail(`Please add an emergency contact${who}.`)
    if (isCamp) {
      if (!pl.emergencyRelationship) return fail(`Please say how the emergency contact is related to the child${who}.`)
      if (!phoneOk(pl.emergencyPhone)) return fail(`Please enter an Australian phone number for the emergency contact${who}.`)
      if (pl.medicalAnswer === 'none') pl.medical = 'None'
      else if (pl.medicalAnswer !== 'yes') return fail(`Please answer the medical question${who} — choose “None” or give details.`)
      else if (!pl.medical || /^none\.?$/i.test(pl.medical)) return fail(`Please give the medical details${who}, or choose “None”.`)
    }
  }
  const keyOf = (pl: (typeof players)[number]) => pl.participantId ? `id:${pl.participantId}` : `${pl.firstName.toLowerCase()}|${pl.dateOfBirth}`
  if (new Set(players.map(keyOf)).size < players.length) return fail('The same child is in this booking twice — remove one.')
  if (fd.get('terms') !== 'on') return fail('Please accept the terms to continue.')

  // Capacity (for every child in the booking)
  let sessionStart: string | undefined
  if (usesSlots) {
    const slot = program.slots!.find((s) => s.start === str(fd, 'slot'))
    if (!slot) return fail('Please choose a time.')
    if (new Date(slot.start) < new Date()) return fail('That time has passed — please choose another.')
    sessionStart = slot.start
    const left = (slot.capacity ?? 1) - (await placesTaken(p, program.id, sessionStart))
    if (left < players.length) return fail(left <= 0 ? 'Sorry, that time was just booked. Please choose another.' : `Sorry, that time only has ${left} place${left === 1 ? '' : 's'} left.`)
  }
  if (isCamp && program.capacity) {
    // Places are per day
    const taken = await campBookings(p, program.id)
    const counts = placesByDay(campDays.map((d) => d.date), taken)
    for (const d of quote!.days) {
      const left = program.capacity - (counts.get(d) ?? 0)
      if (left < players.length) return fail(left <= 0 ? `Sorry, ${campDayLabel(d)} is full — choose other days.` : `Sorry, ${campDayLabel(d)} only has ${left} place${left === 1 ? '' : 's'} left.`)
    }
  } else if (program.capacity) {
    const left = program.capacity - (await placesTaken(p, program.id))
    if (left < players.length) return fail(left <= 0 ? 'Sorry, this program has just filled up.' : `Sorry, there ${left === 1 ? 'is only 1 place' : `are only ${left} places`} left.`)
  }

  const payee = isPayee(program.payee) ? program.payee : defaultPayee(program.type)
  const price = quote ? quote.total : program.price ?? 0
  const campChoice = quote ? campChoiceLabel({ fullCamp: quote.fullCamp, days: quote.days, totalDays: campDays.length }) : ''
  const bookings: { id: number; reference: string; due: number; promo: Awaited<ReturnType<typeof findDiscount>>; pl: (typeof players)[number] }[] = []
  let lead = ''
  for (const pl of players) {
    const reference = newReference(payee)
    lead ||= reference
    // Promotion for this family (worked out on the server, per child — usage limits count each one)
    const promo = await findDiscount(p, accountId, [{ target: { kind: 'program', programId: program.id, programType: program.type }, amount: price }])
    const due = Math.round((price - (promo?.off ?? 0)) * 100) / 100
    const { suffix: _s, participantId: _pid, medicalAnswer: _m, keepWith, ...player } = pl
    const booking = await p.create({
      collection: 'bookings',
      data: {
        reference,
        checkoutGroup: players.length > 1 ? lead : undefined,
        program: program.id,
        status: 'pending',
        payee,
        amount: due,
        discount: promo?.off,
        promotion: promo?.promotion,
        sessionStart,
        ...(quote ? { fullCamp: quote.fullCamp, campDays: quote.days.map((day) => ({ day })), keepWith } : {}),
        account: accountId,
        participant: offeredParticipant?.id,
        contact,
        player,
      },
    })
    if (promo && accountId) await recordUse(p, { applied: promo, account: accountId, kind: 'program', reference, paidAmount: due })
    bookings.push({ id: booking.id, reference, due, promo, pl })
  }
  const reference = lead
  // Logged-in family: keep each child (and their medical / emergency details) on the account for next time
  if (accountId && !isTeamEntry) {
    for (const b of bookings) {
      if (!b.pl.firstName || !b.pl.dateOfBirth) continue
      const kidId = await rememberKid(p, accountId, {
        participantId: b.pl.participantId,
        firstName: b.pl.firstName,
        lastName: b.pl.lastName,
        dateOfBirth: b.pl.dateOfBirth,
        medical: b.pl.medical,
        emergencyName: b.pl.emergencyName,
        emergencyRelationship: b.pl.emergencyRelationship,
        emergencyPhone: b.pl.emergencyPhone,
        photoConsent: b.pl.photoConsent,
      })
      if (kidId && !offeredParticipant) await p.update({ collection: 'bookings', id: b.id, data: { participant: kidId }, overrideAccess: true, depth: 0 })
    }
  }
  const due = Math.round(bookings.reduce((n, b) => n + b.due, 0) * 100) / 100
  const off = Math.round(bookings.reduce((n, b) => n + (b.promo?.off ?? 0), 0) * 100) / 100
  let url: string
  if (due === 0) {
    await confirmPayment(p, 'booking', reference)
    url = `/checkout/success?kind=booking&ref=${reference}`
  } else {
    try {
      const checkout = await startCheckout({
        payee,
        kind: 'booking',
        reference,
        email: contact.email,
        items: bookings.map((b) => ({ name: program.title, description: isTeamEntry ? b.pl.teamName : `${b.pl.firstName} ${b.pl.lastName}${campChoice ? ` — ${campChoice}` : ''}`, unitAmount: price, quantity: 1 })),
        discount: off > 0 ? { amount: off, label: bookings.find((b) => b.promo)!.promo!.label } : null,
        cancelPath: `/programs/${program.slug}/book?cancelled=1`,
      })
      if (checkout.sessionId) for (const b of bookings) await p.update({ collection: 'bookings', id: b.id, data: { stripeCheckoutId: checkout.sessionId } })
      url = checkout.url
    } catch (e) {
      for (const b of bookings) await p.update({ collection: 'bookings', id: b.id, data: { status: 'cancelled' } })
      p.logger.error(e)
      return fail('We couldn’t start the payment. Please try again, or contact the club if this keeps happening.')
    }
  }
  redirect(url)
}
