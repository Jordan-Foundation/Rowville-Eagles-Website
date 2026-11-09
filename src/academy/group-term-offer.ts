import type { Payload } from 'payload'
import type { AcademyCoach, AcademyGroup, AcademyGroupInvite, AcademyTerm, User } from '@/payload-types'
import { emailLayout, esc } from '../lib/email-templates'
import { sendEmail } from '../lib/email'
import { formatAUD, formatDate } from '../lib/format'
import { siteUrl } from '../lib/payments'
import { sendSms } from '../lib/sms'
import { groupSettings } from './group-pricing'
import { groupDeadline } from './group-rules'
import { laterWeeks, restOfTermQuote, termRateFrom } from './group-term'
import { hashShareToken, newShareToken } from './share-rules'
import { GroupError, groupInviteUrl, groupInvites, groupWhen } from './groups'
import { coachClashes, groupSlots, holdMoreSlots, releaseHeldSlotsAfter } from './group-holds'

const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null | undefined) ?? null)
const q = { overrideAccess: true } as const
const isPaid = (i: AcademyGroupInvite) => i.status === 'paid' || i.status === 'weekly'
const history = (g: AcademyGroup, action: string, by?: number | null) => [...(g.history ?? []), { at: new Date().toISOString(), by: by ?? undefined, action }]
const short = (iso: string) => formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

async function load(p: Payload, groupId: number) {
  const g = await p.findByID({ collection: 'academy-groups', id: groupId, depth: 0, ...q })
  const [coach, term, invites, settings] = await Promise.all([
    p.findByID({ collection: 'academy-coaches', id: rel(g.coach)!, depth: 1, ...q }) as Promise<AcademyCoach>,
    p.findByID({ collection: 'academy-terms', id: rel(g.term)!, depth: 0, ...q }) as Promise<AcademyTerm>,
    groupInvites(p, g.id),
    p.findGlobal({ slug: 'academy-settings', depth: 0, ...q }),
  ])
  return { g, coach, term, invites, gs: groupSettings(settings) }
}

/** What the term would look like for this one-off group (no clash check). */
export async function termOfferPreview(p: Payload, groupId: number) {
  const { g, term, gs } = await load(p, groupId)
  if (g.type !== 'casual') return null
  const later = laterWeeks(term, g.firstSessionAt, { now: new Date(), cutoffHours: term.bookingCutoffHours ?? 24 })
  if (!later.weeks.length) return null
  const quote = restOfTermQuote(g.ratePerPlayer, gs.termDiscountPct, later.weeks.length, g.ratePerPlayer)
  return { ...later, quote, discountPct: gs.termDiscountPct }
}

/** Email + text one family about the offer, with a fresh link (their first link keeps working). */
async function tellFamily(p: Payload, g: AcademyGroup, coach: AcademyCoach, inv: AcademyGroupInvite, o: { subject: string; heading: string; intro: string; text: string; cta: string }) {
  const token = newShareToken()
  await p.update({ collection: 'academy-group-invites', id: inv.id, ...q, data: { altTokenHash: hashShareToken(token) } })
  const url = groupInviteUrl(token)
  const i = inv.invitee
  await sendEmail(p, { to: i.email, subject: o.subject, html: emailLayout('academy', [{ heading: o.heading, intro: `Hi ${esc(i.parentFirstName)},<br><br>${o.intro}`, rows: [['Coach', coach.displayName], ['When', groupWhen(g)]], cta: { label: o.cta, href: url } }]), sender: 'academy', userId: rel(inv.account) ?? undefined })
  if (i.mobile) {
    const user = rel(inv.account) ? await p.findByID({ collection: 'users', id: rel(inv.account)!, depth: 0, ...q, disableErrors: true }) : null
    await sendSms(p, { to: i.mobile, kind: 'service', optedOut: user?.smsOptOut, userId: user?.id, body: `Hi ${i.parentFirstName}, ${o.text} ${url}` })
  }
}

async function tellCoach(p: Payload, g: AcademyGroup, coach: AcademyCoach, subject: string, intro: string) {
  const user = typeof coach.user === 'object' ? (coach.user as User) : null
  if (!user) return
  const link = `${siteUrl()}/coach/sessions/group/${g.id}`
  await sendEmail(p, { to: user.email, subject, html: emailLayout('academy', [{ heading: subject, intro: esc(intro), cta: { label: 'Open the group', href: link } }]), sender: 'academy', userId: user.id })
}

/**
 * Propose booking the whole term together. Called by a family who has paid ("I'm interested") or by the
 * coach (offer again). Holds the later weeks for the coach while families answer, until the deadline.
 */
export async function proposeTermOffer(p: Payload, groupId: number, o: { inviteId?: number; coachId?: number; by?: number | null }) {
  const { g, coach, term, invites, gs } = await load(p, groupId)
  if (o.coachId && rel(g.coach) !== o.coachId) throw new GroupError('Group not found.')
  if (g.type !== 'casual' || g.status !== 'confirmed') throw new GroupError('The term can be offered once everyone has paid for the one-off session.')
  if (g.termOffer?.status === 'proposed' || g.termOffer?.status === 'accepted') throw new GroupError('The term has already been offered.')
  const paid = invites.filter(isPaid)
  const proposer = o.inviteId ? paid.find((i) => i.id === o.inviteId) : undefined
  if (o.inviteId && !proposer) throw new GroupError('Only a family who has paid can ask for the term.')
  const later = laterWeeks(term, g.firstSessionAt, { now: new Date(), cutoffHours: term.bookingCutoffHours ?? 24 })
  if (!later.weeks.length) throw new GroupError('There are no weeks left in this term after the one-off session.')
  const deadline = groupDeadline({ now: new Date(), firstSessionAt: later.weeks[0], hours: gs.inviteDeadlineHours, cutoffHours: term.bookingCutoffHours ?? 24 })
  if (!deadline) throw new GroupError('It’s too close to next week’s session to arrange the term online — ask your coach.')
  if ((await coachClashes(p, coach.id, later.weeks)).length) throw new GroupError(`${coach.displayName} isn’t free at this time every week for the rest of the term, so it can’t be booked as a term — ask them about another time.`)
  const held = await holdMoreSlots(p, { groupId: g.id, coachId: coach.id, dates: later.weeks })
  if (!held.ok) throw new GroupError(`${coach.displayName} isn’t free at this time every week for the rest of the term.`)
  for (const inv of paid) await p.update({ collection: 'academy-group-invites', id: inv.id, ...q, data: { termAnswer: inv.id === proposer?.id ? 'accepted' : 'pending' } })
  const updated = await p.update({ collection: 'academy-groups', id: g.id, ...q, data: { termOffer: { status: 'proposed', proposedBy: proposer?.id ?? null, deadline: deadline.toISOString() }, history: history(g, proposer ? `${proposer.invitee.playerFirstName}’s family asked to book the term` : 'Coach offered the term', o.by) } })
  const quote = restOfTermQuote(g.ratePerPlayer, gs.termDiscountPct, later.weeks.length, g.ratePerPlayer)
  const who = proposer ? `${proposer.invitee.playerFirstName}’s family would like` : `${coach.displayName} would like`
  for (const inv of paid) {
    if (inv.id === proposer?.id) continue
    try {
      await tellFamily(p, updated, coach, inv, {
        subject: `Book the whole term together? ${gs.termDiscountPct}% off for ${inv.invitee.playerFirstName}’s small group`,
        heading: 'Book the whole term together?',
        intro: esc(`${who} to keep this small group going for the rest of the term — ${later.weekday}s at the same time, ${later.weeks.length} more weeks at ${formatAUD(quote.rate)} a session (${gs.termDiscountPct}% off). It only goes ahead if every family says yes by ${short(deadline.toISOString())}.`),
        text: `${who} to book ${inv.invitee.playerFirstName}’s small group for the rest of the term at ${gs.termDiscountPct}% off. Yes or no by ${short(deadline.toISOString())}:`,
        cta: 'Answer yes or no',
      })
    } catch (e) {
      p.logger.error({ err: e, msg: `Term offer message failed for invite ${inv.id}` })
    }
  }
  await settleTermOffer(p, g.id)
  return updated
}

/** A family answers the offer. */
export async function answerTermOffer(p: Payload, inviteId: number, yes: boolean) {
  const inv = await p.findByID({ collection: 'academy-group-invites', id: inviteId, depth: 0, ...q })
  const g = await p.findByID({ collection: 'academy-groups', id: rel(inv.group)!, depth: 0, ...q })
  if (g.termOffer?.status !== 'proposed' || !isPaid(inv)) throw new GroupError('This offer has closed.')
  await p.update({ collection: 'academy-group-invites', id: inv.id, ...q, data: { termAnswer: yes ? 'accepted' : 'declined' } })
  return settleTermOffer(p, g.id)
}

/** Everyone said yes → book the term; anyone said no → it stays a one-off. Otherwise keep waiting. */
export async function settleTermOffer(p: Payload, groupId: number) {
  const { g, invites } = await load(p, groupId)
  if (g.termOffer?.status !== 'proposed') return g.termOffer?.status ?? 'none'
  const paid = invites.filter(isPaid)
  if (paid.some((i) => i.termAnswer === 'declined')) return endTermOffer(p, groupId, 'declined')
  if (paid.length && paid.every((i) => i.termAnswer === 'accepted')) return startTerm(p, groupId)
  return 'proposed'
}

/** The offer fell through (a no, or no answer by the deadline): let the weeks go and tell everyone. */
export async function endTermOffer(p: Payload, groupId: number, why: 'declined' | 'expired') {
  const { g, coach, invites } = await load(p, groupId)
  const { docs } = await p.update({ collection: 'academy-groups', where: { id: { equals: g.id }, 'termOffer.status': { equals: 'proposed' } }, ...q, data: { termOffer: { ...g.termOffer, status: why }, history: history(g, why === 'declined' ? 'Term offer declined — stays a one-off' : 'Term offer ran out of time — stays a one-off') } })
  if (!docs.length) return why
  await releaseHeldSlotsAfter(p, g.id, g.firstSessionAt)
  const reason = why === 'declined' ? 'not every family could commit to the term' : 'not every family answered in time'
  for (const inv of invites.filter(isPaid)) {
    try {
      await sendEmail(p, {
        to: inv.invitee.email,
        subject: `${inv.invitee.playerFirstName}’s small group stays a one-off`,
        html: emailLayout('academy', [{ heading: 'The term won’t go ahead this time', intro: `Hi ${esc(inv.invitee.parentFirstName)}, ${esc(reason)}, so ${esc(inv.invitee.playerFirstName)}’s small group stays a one-off session on ${esc(groupWhen(g))}. Nothing has changed with what you’ve paid. Your coach can offer the term again later.` }]),
        sender: 'academy',
        userId: rel(inv.account) ?? undefined,
      })
    } catch (e) {
      p.logger.error({ err: e, msg: `Term offer ended message failed for invite ${inv.id}` })
    }
  }
  try {
    await tellCoach(p, g, coach, 'The term offer for your small group fell through', `The term offer for your small group (${groupWhen(g)}) ${why === 'declined' ? 'was declined by a family' : 'ran out of time'}. It stays a one-off; the later weeks are free again. You can offer the term again from the group page.`)
  } catch (e) {
    p.logger.error({ err: e, msg: `Term offer coach alert failed for ${g.reference}` })
  }
  return why
}

/**
 * Everyone said yes: the group becomes a term group (the one-off is week 1) and each family gets a link to
 * book weeks 2 onwards at the term price, less what they overpaid for week 1. The usual deadline,
 * reminders and coach decisions apply to these payments.
 */
async function startTerm(p: Payload, groupId: number) {
  const { g, coach, term, invites, gs } = await load(p, groupId)
  const { docs: claimed } = await p.update({ collection: 'academy-groups', where: { id: { equals: g.id }, 'termOffer.status': { equals: 'proposed' } }, ...q, data: { termOffer: { ...g.termOffer, status: 'accepted' } } })
  if (!claimed.length) return 'accepted'
  // The weeks held for the offer (not recalculated, so nothing moves under the families)
  const held = (await groupSlots(p, g.id)).filter((s) => s.startsAt > g.firstSessionAt).map((s) => s.startsAt)
  const { weekday, time } = laterWeeks(term, g.firstSessionAt, { now: new Date(), cutoffHours: term.bookingCutoffHours ?? 24 })
  const later = { weekday, time, weeks: held }
  const rate = termRateFrom(g.ratePerPlayer, gs.termDiscountPct)
  const deadline = new Date(g.termOffer?.deadline ?? Date.now() + gs.inviteDeadlineHours * 3_600_000)
  const firstLater = later.weeks[0]
  const payBy = firstLater ? groupDeadline({ now: new Date(), firstSessionAt: firstLater, hours: gs.inviteDeadlineHours, cutoffHours: term.bookingCutoffHours ?? 24 }) ?? deadline : deadline
  const updated = await p.update({
    collection: 'academy-groups',
    id: g.id,
    ...q,
    data: {
      type: 'term',
      weekday: later.weekday,
      startTime: later.time,
      sessionsTotal: 1 + later.weeks.length,
      ratePerPlayer: rate,
      status: 'forming',
      paymentDeadline: payBy.toISOString(),
      reminderSentAt: null,
      history: history(g, `Everyone said yes — booking the term at ${formatAUD(rate)} a session`),
    },
  })
  const paid = invites.filter(isPaid)
  const quote = restOfTermQuote(g.ratePerPlayer, gs.termDiscountPct, later.weeks.length, g.ratePerPlayer)
  for (const inv of paid) {
    await p.update({ collection: 'academy-group-invites', id: inv.id, ...q, data: { status: 'invited', rateLocked: rate } })
    try {
      await tellFamily(p, updated, coach, inv, {
        subject: `Everyone’s in — book the rest of the term for ${inv.invitee.playerFirstName}`,
        heading: 'Everyone said yes!',
        intro: esc(`The small group is going ahead for the rest of the term: ${later.weeks.length} more weeks at ${formatAUD(rate)} a session. What you paid for week 1 counts — ${formatAUD(quote.credit)} comes off, so the rest of the term is ${formatAUD(quote.total)}. Pay upfront or weekly by ${short(payBy.toISOString())}.`),
        text: `everyone said yes! Book ${inv.invitee.playerFirstName}’s small group for the rest of the term (${formatAUD(quote.total)}, or weekly) by ${short(payBy.toISOString())}:`,
        cta: 'Book the rest of the term',
      })
    } catch (e) {
      p.logger.error({ err: e, msg: `Term booking message failed for invite ${inv.id}` })
    }
  }
  try {
    await tellCoach(p, g, coach, 'Your small group is booking the term', `Every family said yes — your small group (${later.weekday}s at the same time) is booking the rest of the term. Families have their links to pay; you’ll hear when everyone has.`)
  } catch (e) {
    p.logger.error({ err: e, msg: `Term start coach alert failed for ${g.reference}` })
  }
  return 'accepted'
}

/**
 * What a family still owes for their place: the group's future dates they don't already have (so a
 * one-off that became week 1 isn't charged twice), at their locked price, less any week-1 difference.
 */
export async function placeDue(p: Payload, invite: AcademyGroupInvite, group: AcademyGroup) {
  const now = Date.now()
  const slots = (await groupSlots(p, group.id)).filter((x) => new Date(x.startsAt).getTime() > now)
  const { docs: mine } = await p.find({ pagination: false, collection: 'academy-bookings', where: { groupInvite: { equals: invite.id }, status: { in: ['confirmed', 'completed', 'payment_failed'] } }, limit: 10, depth: 0, ...q })
  const { docs: have } = mine.length
    ? await p.find({ pagination: false, collection: 'academy-sessions', where: { booking: { in: mine.map((b) => b.id) }, status: { not_equals: 'cancelled' } }, limit: 100, depth: 0, ...q, select: { startsAt: true } })
    : { docs: [] as { startsAt: string }[] }
  const taken = new Set(have.map((s) => new Date(s.startsAt).getTime()))
  const sessions = slots.filter((x) => !taken.has(new Date(x.startsAt).getTime())).map((x) => x.startsAt)
  const oneOff = mine.find((b) => b.type === 'casual')
  const { week1Credit } = await import('./group-term')
  const credit = group.type === 'term' && oneOff && sessions.length ? week1Credit(oneOff.amount, invite.rateLocked) : 0
  const full = Math.round(invite.rateLocked * sessions.length * 100) / 100
  return { sessions, full, credit, amount: Math.max(0, Math.round((full - credit) * 100) / 100), restOfTerm: Boolean(oneOff) }
}
