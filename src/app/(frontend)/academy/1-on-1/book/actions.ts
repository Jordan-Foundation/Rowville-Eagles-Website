'use server'

import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { makeReference } from '@/lib/reference'
import { startCheckout } from '@/lib/payments'
import { paymentsMode } from '@/lib/stripe-accounts'
import { findTermSlot, isCasualOpen } from '@/academy/slots'
import { createHold, holdMinutesFor, loadTermBookingData, releaseAcademyHold, releaseExpiredHolds } from '@/academy/booking-data'
import { toYmd } from '@/academy/term-dates'
import { weeklyPlan, type WeeklyPlan } from '@/academy/weekly'
import { formatDate } from '@/lib/format'
import type { Weekday } from '@/academy/constants'

export type BookState = { error?: string; values?: Record<string, string> }

const MOBILE = /^(\+?61|0)4\d{8}$/

/** Casual one-off or whole-term booking. Price and session dates are always worked out here, on the server. */
export async function bookSession(_prev: BookState, fd: FormData): Promise<BookState> {
  const values = Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, String(v)]))
  const fail = (error: string): BookState => ({ error, values })
  const s = (k: string) => (values[k] ?? '').trim()
  const mode = s('mode') === 'term' ? 'term' : 'casual'

  const p = await payload()
  const user = await currentUser()
  await releaseExpiredHolds(p)

  const coachId = Number(s('coach'))
  const termId = Number(s('term'))
  const term = termId ? await p.findByID({ collection: 'academy-terms', id: termId, depth: 0, disableErrors: true }) : null
  if (!term || term.status !== 'open' || !coachId) return fail('This booking isn’t available any more.')
  const data = await loadTermBookingData(p, term)
  const engine = { term, coaches: data.availability, taken: data.taken, now: new Date(), cutoffHours: term.bookingCutoffHours ?? 24 }

  // Re-check the slot and work out the sessions + price
  let sessions: { startsAt: string; needsCover?: boolean }[]
  let amount: number
  let weekday: Weekday | undefined
  let startTime: string | undefined
  let plan: WeeklyPlan | null = null
  if (mode === 'term') {
    const slot = findTermSlot({ ...engine, minSessions: term.minTermSessions ?? 2, coachId, weekday: s('weekday'), time: s('time') })
    if (!slot) return fail('Sorry — that weekly time has just been booked. Please choose another.')
    const away = new Set(slot.awayDates[coachId] ?? [])
    sessions = slot.sessions.map((startsAt) => ({ startsAt, needsCover: away.has(toYmd(startsAt)) }))
    amount = term.pricePerSession * sessions.length
    weekday = slot.weekday
    startTime = slot.time
    if (s('expectedSessions') && Number(s('expectedSessions')) !== sessions.length) {
      return fail(`The number of sessions left has changed to ${sessions.length} (${formatPrice(amount)}). Please check the details and continue.`)
    }
    if (s('payMode') === 'weekly') {
      plan = weeklyPlan(sessions.map((x) => x.startsAt))
      if (!plan) return fail('Weekly payments aren’t available for this booking — please pay for the term upfront.')
    }
  } else {
    const startsAt = s('start')
    if (Number.isNaN(Date.parse(startsAt)) || !isCasualOpen({ ...engine, coachId, startsAt })) return fail('Sorry — that time has just been booked. Please choose another.')
    sessions = [{ startsAt: new Date(startsAt).toISOString() }]
    amount = term.casualPrice
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
    type: mode,
    paymentMode: mode === 'casual' ? 'casual' : plan ? 'weekly' : 'upfront',
    chargeAnchorAt: plan ? new Date(plan.anchor * 1000).toISOString() : undefined,
    amount,
    sessionsTotal: sessions.length,
    sessionsPaid: 0,
    coach: coachId,
    term: term.id,
    weekday,
    startTime,
    firstSessionAt: sessions[0].startsAt,
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
    sessions,
    holdMinutes,
  })
  if (!hold.ok) return fail('Sorry — someone booked that time a moment ago. Please choose another.')

  const first = sessions[0].startsAt
  const last = sessions.at(-1)!.startsAt
  const back = mode === 'term' ? `mode=term&coach=${coachId}&weekday=${weekday}&time=${startTime}` : `coach=${coachId}&start=${encodeURIComponent(first)}`
  let url: string
  try {
    const checkout = await startCheckout({
      payee: 'academy',
      kind: 'academy',
      reference,
      email: contact.email,
      ...(plan
        ? {
            weekly: {
              name: `Weekly 1-on-1 with ${coach.displayName}`,
              description: `${player.firstName} ${player.lastName} · ${weekday}s ${formatDate(first, { hour: 'numeric', minute: '2-digit' })} · ${plan.recurringCharges} weekly payments, 2 days before each session, ending ${formatDate(plan.chargeDates.at(-1)!, { day: 'numeric', month: 'short' })}`,
              unitAmount: term.pricePerSession,
              anchor: plan.anchor,
            },
          }
        : {}),
      items: plan
        ? [{ name: `First session — ${formatDate(first, { weekday: 'short', day: 'numeric', month: 'short' })}`, description: `Term of 1-on-1s with ${coach.displayName} · ${sessions.length} sessions, paid weekly`, unitAmount: term.pricePerSession, quantity: 1 }]
        : mode === 'term'
          ? [{ name: `Term of 1-on-1s with ${coach.displayName}`, description: `${player.firstName} ${player.lastName} · ${weekday}s ${formatDate(first, { hour: 'numeric', minute: '2-digit' })} · ${sessions.length} sessions, ${formatDate(first, { day: 'numeric', month: 'short' })} – ${formatDate(last, { day: 'numeric', month: 'short' })}`, unitAmount: term.pricePerSession, quantity: sessions.length }]
          : [{ name: `1-on-1 with ${coach.displayName}`, description: `${player.firstName} ${player.lastName} · ${formatDate(first, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`, unitAmount: term.casualPrice, quantity: 1 }],
      cancelPath: `/academy/1-on-1/book?${back}&cancelled=${reference}`,
      successPath: '/academy/1-on-1/booked',
      expiresInMinutes: holdMinutes,
    })
    if (checkout.sessionId) await p.update({ collection: 'academy-bookings', id: hold.booking.id, data: { stripeCheckoutId: checkout.sessionId }, overrideAccess: true })
    url = checkout.url
  } catch (e) {
    p.logger.error(e)
    await releaseAcademyHold(p, reference)
    return fail('We couldn’t start the payment. Please try again shortly.')
  }
  redirect(url)
}

const formatPrice = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n)
