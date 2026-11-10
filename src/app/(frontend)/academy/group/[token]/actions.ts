'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { rateLimit } from '@/lib/form-guard'
import { payload } from '@/lib/payload'
import { makeReference } from '@/lib/reference'
import { startCheckout } from '@/lib/payments'
import { paymentsMode } from '@/lib/stripe-accounts'
import { formatDate } from '@/lib/format'
import { confirmAcademyBooking, createHold, holdMinutesFor, releaseAcademyHold, releaseBooking, releaseExpiredHolds } from '@/academy/booking-data'
import { creditBalance, creditStateFor, reserveCredit } from '@/academy/credits'
import { weeklyPlan } from '@/academy/weekly'
import { findGroupInvite } from '@/academy/groups'
import { placeDue } from '@/academy/group-term-offer'
import { declineGroupInvite } from '@/academy/group-payments'
import { MOBILE } from '@/academy/group-rules'

export type GroupPayState = { error?: string; values?: Record<string, string> }

const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null | undefined) ?? null)
const money = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n)

/**
 * A family pays for their own player's place. The price is the one locked on their invite × the group's
 * sessions — always worked out here. Uses the same held booking + Stripe checkout as a 1-on-1.
 */
export async function payGroupPlace(_prev: GroupPayState, fd: FormData): Promise<GroupPayState> {
  const values = Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, String(v).slice(0, 2000)]))
  const fail = (error: string): GroupPayState => ({ error, values })
  const s = (k: string) => (values[k] ?? '').trim()
  const p = await payload()
  const limited = await rateLimit(p, 'group-pay', { perIp: 20 })
  if (limited) return fail(limited)
  await releaseExpiredHolds(p)

  const found = await findGroupInvite(p, s('token'))
  if (!found) return fail('This link has expired — please check your latest message from your coach.')
  const { invite, group } = found
  if (invite.status === 'paid' || invite.status === 'weekly') return fail('This place is already paid.')
  if (invite.status === 'declined' || invite.status === 'removed' || group.status === 'cancelled' || group.status === 'completed') return fail('This place isn’t available any more — please contact your coach.')

  const term = await p.findByID({ collection: 'academy-terms', id: rel(group.term)!, depth: 0, overrideAccess: true })
  const now = Date.now()
  // The dates they don't have yet (a one-off that became week 1 isn't charged again), less any week-1 difference
  const due = await placeDue(p, invite, group)
  const slots = due.sessions.map((startsAt) => ({ startsAt }))
  void now
  if (!slots.length) return fail('This group has already started — please contact your coach.')
  const sessions = slots.map((x) => ({ startsAt: x.startsAt }))
  const amount = due.amount
  const perSession = Math.round((amount / sessions.length) * 100) / 100
  const weekly = group.type === 'term' && s('payMode') === 'weekly'
  const plan = weekly ? weeklyPlan(sessions.map((x) => x.startsAt)) : null
  if (weekly && !plan) return fail('Weekly payments aren’t available for this group — please pay upfront.')

  // Parent — the invite's details; the mobile can be corrected
  const i = invite.invitee
  const contact = { firstName: i.parentFirstName, lastName: i.parentLastName, email: i.email.toLowerCase(), mobile: (s('contactMobile') || i.mobile || '').replace(/\s+/g, '') }
  if (!MOBILE.test(contact.mobile)) return fail('Please enter an Australian mobile number, e.g. 0412 345 678.')

  // Player — the club's record if they already have one, otherwise what the family enters now
  const kid = rel(invite.participant) ? await p.findByID({ collection: 'participants', id: rel(invite.participant)!, depth: 0, overrideAccess: true, disableErrors: true }) : null
  const dob = kid?.dateOfBirth ?? s('playerDob')
  if (!dob || Number.isNaN(Date.parse(dob))) return fail(`Please enter ${i.playerFirstName}’s date of birth.`)
  if (!s('emergencyName') || !s('emergencyPhone')) return fail('Please add an emergency contact.')
  if (fd.get('terms') !== 'on') return fail('Please accept the terms to continue.')
  try {
    paymentsMode('academy')
  } catch {
    return fail('Online payments aren’t set up yet — please contact the Academy.')
  }

  // A checkout this family started earlier and didn't finish is let go first
  const earlier = rel(invite.booking) ? await p.findByID({ collection: 'academy-bookings', id: rel(invite.booking)!, depth: 0, overrideAccess: true, disableErrors: true }) : null
  if (earlier?.status === 'held') await releaseBooking(p, earlier, 'cancelled')

  const coach = await p.findByID({ collection: 'academy-coaches', id: rel(group.coach)!, depth: 0, overrideAccess: true })
  const { docs: everyone } = await p.find({ pagination: false, collection: 'academy-group-invites', where: { group: { equals: group.id }, status: { not_in: ['removed', 'declined'] } }, limit: 20, depth: 0, overrideAccess: true })
  const reference = makeReference('RFA')
  const holdMinutes = holdMinutesFor(term)
  // Small group credits (from a cancelled group session) pay for sessions first — not with weekly plans
  const accountId = rel(invite.account)
  const creditSessionsUsed = accountId && !plan ? Math.min(await creditBalance(p, accountId, undefined, 'group'), sessions.length) : 0
  const creditUse = Math.round(creditSessionsUsed * perSession * 100) / 100
  const charge = Math.round((amount - creditUse) * 100) / 100
  const hold = await createHold(p, {
    reference,
    kind: 'group',
    group: group.id,
    groupInvite: invite.id,
    groupSize: everyone.length,
    groupWeek1Credit: due.credit || undefined,
    creditApplied: creditUse || undefined,
    creditSessionsUsed: creditSessionsUsed || undefined,
    type: group.type,
    paymentMode: group.type === 'casual' ? 'casual' : plan ? 'weekly' : 'upfront',
    chargeAnchorAt: plan ? new Date(plan.anchor * 1000).toISOString() : undefined,
    amount,
    sessionsTotal: sessions.length,
    sessionsPaid: 0,
    coach: coach.id,
    term: term.id,
    weekday: group.weekday ?? undefined,
    startTime: group.startTime ?? undefined,
    firstSessionAt: sessions[0].startsAt,
    contact,
    player: {
      firstName: kid?.firstName || i.playerFirstName,
      lastName: kid?.lastName || i.playerLastName,
      dateOfBirth: dob,
      goals: s('goals') || undefined,
      medical: s('medical') || kid?.medical?.conditions || undefined,
      emergencyName: s('emergencyName'),
      emergencyPhone: s('emergencyPhone'),
      photoConsent: fd.get('photoConsent') === 'on',
    },
    account: rel(invite.account) ?? undefined,
    participant: kid?.id,
    source: 'coach-link',
    sessions,
    holdMinutes,
  })
  if (!hold.ok) return fail('We couldn’t hold this place — please try again, or contact your coach.')
  await p.update({ collection: 'academy-group-invites', id: invite.id, overrideAccess: true, data: { booking: hold.booking.id } })
  if (creditUse > 0) {
    await reserveCredit(p, { account: accountId!, sessions: creditSessionsUsed, value: creditUse, booking: hold.booking.id, scope: 'group' })
    if ((await creditStateFor(p, accountId!, undefined, 'group')).overdrawn) {
      await releaseAcademyHold(p, reference)
      return fail('Your credit is being used in another checkout. Please try again in a moment.')
    }
    if (charge <= 0) {
      // Fully covered by small group credit — no card payment
      await confirmAcademyBooking(p, reference)
      redirect(`/academy/1-on-1/booked?kind=academy&ref=${reference}&credit=1`)
    }
  }

  const first = sessions[0].startsAt
  const name = `Small group with ${coach.displayName}`
  const who = `${i.playerFirstName} ${i.playerLastName}`
  let url: string
  try {
    const checkout = await startCheckout({
      payee: 'academy',
      kind: 'academy',
      reference,
      email: contact.email,
      ...(plan
        ? { saveCardFor: { note: `Today you pay for the first session. Your card is then saved and ${money(perSession)} is charged automatically 2 days before each later session — ${plan.recurringCharges} payments, ${formatDate(plan.chargeDates[1], { day: 'numeric', month: 'short' })} to ${formatDate(plan.chargeDates.at(-1)!, { day: 'numeric', month: 'short' })}. Total ${money(amount)}.` } }
        : {}),
      items: creditUse > 0
        ? [{ name: group.type === 'term' ? `${name} — term` : name, description: `${who} · ${sessions.length} session${sessions.length === 1 ? '' : 's'} · ${money(amount)} less ${creditSessionsUsed} small group credit${creditSessionsUsed === 1 ? '' : 's'}`, unitAmount: charge, quantity: 1 }]
        : plan
        ? [{ name: `First session — ${formatDate(first, { weekday: 'short', day: 'numeric', month: 'short' })}`, description: `${name} · ${who} · ${sessions.length} sessions, paid weekly${due.credit ? ` · ${money(due.credit)} week-1 credit spread over the term` : ''}`, unitAmount: perSession, quantity: 1 }]
        : group.type === 'term'
          ? due.credit
            ? [{ name: `${name} — rest of the term`, description: `${who} · ${group.weekday}s ${formatDate(first, { hour: 'numeric', minute: '2-digit' })} · ${sessions.length} sessions × ${money(invite.rateLocked)} less ${money(due.credit)} already paid for week 1`, unitAmount: amount, quantity: 1 }]
            : [{ name: `${name} — term`, description: `${who} · ${group.weekday}s ${formatDate(first, { hour: 'numeric', minute: '2-digit' })} · ${sessions.length} sessions`, unitAmount: invite.rateLocked, quantity: sessions.length }]
          : [{ name, description: `${who} · ${formatDate(first, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`, unitAmount: invite.rateLocked, quantity: 1 }],
      cancelPath: `/academy/group/${s('token')}?cancelled=${reference}`,
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

/** "We can't make it" — frees the place and lets the coach know. */
export async function declineGroupPlace(_prev: GroupPayState, fd: FormData): Promise<GroupPayState> {
  const p = await payload()
  const token = String(fd.get('token') ?? '')
  const found = await findGroupInvite(p, token)
  if (!found) return { error: 'This link has expired.' }
  if (found.invite.status !== 'invited' && found.invite.status !== 'overdue') return { error: 'This place can’t be declined here — please contact your coach.' }
  await declineGroupInvite(p, found.invite.id)
  revalidatePath(`/academy/group/${token}`)
  return {}
}

/** "I'm interested" in the term (a family who's paid), or yes/no to an offer another family made. */
export async function termOfferAction(_prev: GroupPayState, fd: FormData): Promise<GroupPayState> {
  const p = await payload()
  const limited = await rateLimit(p, 'group-term', { perIp: 20 })
  if (limited) return { error: limited }
  const token = String(fd.get('token') ?? '')
  const found = await findGroupInvite(p, token)
  if (!found) return { error: 'This link has expired.' }
  const { GroupError } = await import('@/academy/groups')
  const { answerTermOffer, proposeTermOffer } = await import('@/academy/group-term-offer')
  try {
    const what = String(fd.get('do'))
    if (what === 'interested') await proposeTermOffer(p, found.group.id, { inviteId: found.invite.id })
    else if (what === 'yes' || what === 'no') await answerTermOffer(p, found.invite.id, what === 'yes')
    else return { error: 'Unknown choice.' }
  } catch (e) {
    if (e instanceof GroupError) return { error: e.message }
    throw e
  }
  revalidatePath(`/academy/group/${token}`)
  return {}
}
