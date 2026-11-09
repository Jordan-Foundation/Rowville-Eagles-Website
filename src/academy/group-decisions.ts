import type { Payload } from 'payload'
import type { AcademyCoach, AcademyGroup, AcademyGroupInvite, AcademyTerm, User } from '@/payload-types'
import { emailLayout, esc } from '../lib/email-templates'
import { sendEmail } from '../lib/email'
import { siteUrl } from '../lib/payments'
import { sendSms } from '../lib/sms'
import { groupSettings } from './group-pricing'
import { groupDeadline, reminderAt, type RosterPlayer } from './group-rules'
import { hashShareToken, newShareToken } from './share-rules'
import { GroupError, groupInvites, groupWhen, resolveRoster, sendGroupInvite } from './groups'
import { confirmGroupIfComplete } from './group-payments'
import { releaseGroup } from './group-holds'

const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null | undefined) ?? null)
const q = { overrideAccess: true } as const
const UNPAID = ['invited', 'overdue', 'declined'] as const
const isPaid = (i: AcademyGroupInvite) => i.status === 'paid' || i.status === 'weekly'
const history = (g: AcademyGroup, action: string, by?: number | null, note?: string) => [...(g.history ?? []), { at: new Date().toISOString(), by: by ?? undefined, action, note }]

async function context(p: Payload, g: AcademyGroup) {
  const [coach, term] = await Promise.all([
    p.findByID({ collection: 'academy-coaches', id: rel(g.coach)!, depth: 1, ...q }) as Promise<AcademyCoach>,
    p.findByID({ collection: 'academy-terms', id: rel(g.term)!, depth: 0, ...q }) as Promise<AcademyTerm>,
  ])
  return { coach, term }
}

/** Let go of a checkout the family started but didn't finish. */
async function releaseHeld(p: Payload, invite: AcademyGroupInvite) {
  const id = rel(invite.booking)
  if (!id) return
  const b = await p.findByID({ collection: 'academy-bookings', id, depth: 0, ...q, disableErrors: true })
  if (b?.status === 'held') {
    const { releaseBooking } = await import('./booking-data')
    await releaseBooking(p, b, 'cancelled')
  }
}

/** Send a family their link again with a fresh secret. `keepOld` = a reminder (the first link still works). */
async function sendFresh(p: Payload, g: AcademyGroup, invite: AcademyGroupInvite, o: { reminder?: boolean; keepOld?: boolean }) {
  const token = newShareToken()
  const fresh = await p.update({ collection: 'academy-group-invites', id: invite.id, ...q, data: o.keepOld ? { altTokenHash: hashShareToken(token) } : { tokenHash: hashShareToken(token), altTokenHash: null } })
  const { coach, term } = await context(p, g)
  const others = (await groupInvites(p, g.id)).filter((i) => i.id !== invite.id && i.status !== 'declined').map((i) => i.invitee.playerFirstName)
  return sendGroupInvite(p, { group: g, invite: fresh, token, coach, term, others, reminder: o.reminder })
}

async function tellCoach(p: Payload, g: AcademyGroup, o: { subject: string; heading: string; intro: string; text: string }) {
  const coach = (await p.findByID({ collection: 'academy-coaches', id: rel(g.coach)!, depth: 1, ...q })) as AcademyCoach
  const user = typeof coach.user === 'object' ? (coach.user as User) : null
  if (!user) return
  const link = `${siteUrl()}/coach/sessions/group/${g.id}`
  await sendEmail(p, { to: user.email, subject: o.subject, html: emailLayout('academy', [{ heading: o.heading, intro: o.intro, rows: [['When', groupWhen(g)], ['Reference', g.reference]], cta: { label: 'Open the group', href: link } }]), sender: 'academy', userId: user.id })
  if (coach.alerts?.bookingText !== false) await sendSms(p, { to: user.phone, kind: 'coach_alert', optedOut: user.smsOptOut, body: `Foundation Academy: ${o.text} ${link}` })
}

/**
 * The group clock (safe to run any time, as often as you like — each step is claimed once):
 *  - a reminder to families who haven't paid, the set hours before the deadline (with a fresh link);
 *  - at the deadline: unpaid places become Overdue, the group is "short of players" and the coach decides.
 */
export async function sweepGroups(p: Payload, now = new Date()) {
  const gs = groupSettings(await p.findGlobal({ slug: 'academy-settings', depth: 0, ...q }))
  let reminded = 0
  let shortfalls = 0
  const { docs: open } = await p.find({ pagination: false, collection: 'academy-groups', where: { status: { equals: 'forming' }, paymentDeadline: { exists: true } }, limit: 200, depth: 0, ...q })
  for (const g of open) {
    const deadline = new Date(g.paymentDeadline!)
    if (deadline > now) {
      if (g.reminderSentAt) continue
      const at = reminderAt({ sentAt: new Date(g.createdAt), deadline, hoursBefore: gs.reminderHoursBefore })
      if (!at || now < at) continue
      const { docs: claimed } = await p.update({ collection: 'academy-groups', where: { id: { equals: g.id }, reminderSentAt: { exists: false } }, ...q, data: { reminderSentAt: now.toISOString() } })
      if (!claimed.length) continue
      for (const inv of await groupInvites(p, g.id)) {
        if (inv.status !== 'invited') continue
        try {
          await sendFresh(p, claimed[0], inv, { reminder: true, keepOld: true })
          reminded++
        } catch (e) {
          p.logger.error({ err: e, msg: `Group reminder failed for invite ${inv.id}` })
        }
      }
      continue
    }
    // Deadline passed — if everyone has paid it's simply confirmed; otherwise the coach decides
    if (await confirmGroupIfComplete(p, g.id)) continue
    const { docs: claimed } = await p.update({ collection: 'academy-groups', where: { id: { equals: g.id }, status: { equals: 'forming' } }, ...q, data: { status: 'shortfall', history: history(g, 'Payment deadline passed — waiting for the coach') } })
    if (!claimed.length) continue
    const invites = await groupInvites(p, g.id)
    for (const inv of invites) if (inv.status === 'invited') await p.update({ collection: 'academy-group-invites', id: inv.id, ...q, data: { status: 'overdue' } })
    const missing = invites.filter((i) => !isPaid(i)).map((i) => i.invitee.playerFirstName)
    const paid = invites.filter(isPaid).length
    try {
      await tellCoach(p, claimed[0], {
        subject: `Your small group needs a decision — ${missing.join(', ')} ${missing.length === 1 ? 'hasn’t' : 'haven’t'} paid`,
        heading: 'Your small group needs a decision',
        intro: `The payment deadline has passed. ${paid} of ${invites.length} have paid; ${esc(missing.join(', '))} ${missing.length === 1 ? 'hasn’t' : 'haven’t'}. Choose what happens: invite someone else, give them more time, go ahead with a smaller group (same price for the families who paid), or cancel and refund everyone. Your time stays held until you decide.`,
        text: `your small group (${groupWhen(claimed[0])}) is short — ${missing.join(', ')} didn’t pay. Please choose what happens:`,
      })
    } catch (e) {
      p.logger.error({ err: e, msg: `Shortfall alert failed for ${g.reference}` })
    }
    shortfalls++
  }
  // Term offers nobody finished answering in time: the group stays a one-off
  let offersClosed = 0
  const { docs: offers } = await p.find({ pagination: false, collection: 'academy-groups', where: { 'termOffer.status': { equals: 'proposed' }, 'termOffer.deadline': { less_than: now.toISOString() } }, limit: 100, depth: 0, ...q })
  if (offers.length) {
    const { endTermOffer } = await import('./group-term-offer')
    for (const g of offers) {
      try {
        if ((await endTermOffer(p, g.id, 'expired')) === 'expired') offersClosed++
      } catch (e) {
        p.logger.error({ err: e, msg: `Closing term offer failed for ${g.reference}` })
      }
    }
  }
  return { reminded, shortfalls, offersClosed }
}

/** Run the sweep at most every few minutes per server (page visits nudge it between the daily runs). */
let lastSweep = 0
export async function sweepGroupsSoon(p: Payload) {
  if (Date.now() - lastSweep < 5 * 60_000) return
  lastSweep = Date.now()
  try {
    await sweepGroups(p)
  } catch (e) {
    p.logger.error({ err: e, msg: 'Group sweep failed' })
  }
}

async function ownGroup(p: Payload, coachId: number, groupId: number) {
  const g = await p.findByID({ collection: 'academy-groups', id: groupId, depth: 0, ...q, disableErrors: true })
  if (!g || rel(g.coach) !== coachId) throw new GroupError('Group not found.')
  if (g.status === 'cancelled' || g.status === 'completed') throw new GroupError('This group has finished.')
  return g
}

/** A fresh deadline from now (the group goes back to waiting for payments). */
async function reopen(p: Payload, g: AcademyGroup, action: string, by: number) {
  const gs = groupSettings(await p.findGlobal({ slug: 'academy-settings', depth: 0, ...q }))
  const { term } = await context(p, g)
  const deadline = groupDeadline({ now: new Date(), firstSessionAt: g.firstSessionAt, hours: gs.inviteDeadlineHours, cutoffHours: term.bookingCutoffHours ?? 24 })
  if (!deadline) throw new GroupError('It’s too close to the session for families to pay online — call them, or go ahead with the players who’ve paid.')
  const later = g.paymentDeadline && new Date(g.paymentDeadline) > deadline ? g.paymentDeadline : deadline.toISOString()
  return p.update({ collection: 'academy-groups', id: g.id, ...q, data: { status: 'forming', paymentDeadline: later, reminderSentAt: later === g.paymentDeadline ? g.reminderSentAt : null, history: history(g, action, by) } })
}

/** Send a family their link again (the old one stops working). After the deadline it also gives them more time. */
export async function resendGroupInvite(p: Payload, coachId: number, inviteId: number, by: number) {
  const invite = await p.findByID({ collection: 'academy-group-invites', id: inviteId, depth: 0, ...q, disableErrors: true })
  if (!invite) throw new GroupError('Player not found.')
  let g = await ownGroup(p, coachId, rel(invite.group)!)
  if (invite.status !== 'invited' && invite.status !== 'overdue') throw new GroupError('Only families who haven’t paid can be sent the link again.')
  if (g.status === 'shortfall') {
    g = await reopen(p, g, `More time for ${invite.invitee.playerFirstName}`, by)
    await p.update({ collection: 'academy-group-invites', id: invite.id, ...q, data: { status: 'invited' } })
  }
  return sendFresh(p, g, { ...invite, status: 'invited' }, {})
}

/** Someone else takes a place that hasn't been paid for (same price per player as the group). */
export async function replaceGroupPlace(p: Payload, coachId: number, inviteId: number, player: RosterPlayer, by: number) {
  const old = await p.findByID({ collection: 'academy-group-invites', id: inviteId, depth: 0, ...q, disableErrors: true })
  if (!old) throw new GroupError('Player not found.')
  let g = await ownGroup(p, coachId, rel(old.group)!)
  if (!(UNPAID as readonly string[]).includes(old.status)) throw new GroupError('Only a place that hasn’t been paid for can be given to someone else.')
  const [r] = await resolveRoster(p, [player])
  const everyone = await groupInvites(p, g.id)
  if (r.participant && everyone.some((i) => rel(i.participant) === r.participant && i.id !== old.id)) throw new GroupError('That player is already in the group.')
  await releaseHeld(p, old)
  await p.update({ collection: 'academy-group-invites', id: old.id, ...q, data: { status: 'removed' } })
  g = await reopen(p, g, `${old.invitee.playerFirstName} replaced by ${r.invitee.playerFirstName}`, by)
  const token = newShareToken()
  const invite = await p.create({
    collection: 'academy-group-invites',
    ...q,
    data: { group: g.id, tokenHash: hashShareToken(token), status: 'invited', participant: r.participant, account: r.account, invitee: r.invitee, rateLocked: g.ratePerPlayer, termAnswer: 'pending' },
  })
  const { coach, term } = await context(p, g)
  const others = (await groupInvites(p, g.id)).filter((i) => i.id !== invite.id && i.status !== 'declined').map((i) => i.invitee.playerFirstName)
  return sendGroupInvite(p, { group: g, invite, token, coach, term, others })
}

/** Go ahead with the players who've paid — they keep their price (the club covers the difference). */
export async function goAheadSmaller(p: Payload, coachId: number, groupId: number, by: number) {
  const g = await ownGroup(p, coachId, groupId)
  const invites = await groupInvites(p, g.id)
  const paid = invites.filter(isPaid)
  if (paid.length < 2) throw new GroupError(paid.length === 1 ? 'Only one player has paid — offer them a 1-on-1 or cancel and refund.' : 'Nobody has paid yet.')
  for (const inv of invites.filter((i) => !isPaid(i))) {
    await releaseHeld(p, inv)
    await p.update({ collection: 'academy-group-invites', id: inv.id, ...q, data: { status: 'removed' } })
  }
  await p.update({ collection: 'academy-groups', id: g.id, ...q, data: { plannedSize: paid.length, history: history(g, `Going ahead with ${paid.length} players (same price)`, by) } })
  await confirmGroupIfComplete(p, g.id)
  return { players: paid.length }
}

/** Cancel the whole group: everyone who paid gets their money back, families who hadn't paid are told. */
export async function cancelWholeGroup(p: Payload, coachId: number, groupId: number, by: number, reason: string) {
  const g = await ownGroup(p, coachId, groupId)
  const invites = await groupInvites(p, g.id)
  const { cancelAcademy } = await import('./cancellations')
  const problems: string[] = []
  for (const inv of invites) {
    if (isPaid(inv) || inv.status === 'overdue') {
      const bookingId = rel(inv.booking)
      const b = bookingId ? await p.findByID({ collection: 'academy-bookings', id: bookingId, depth: 0, ...q, disableErrors: true }) : null
      if (b && (b.status === 'confirmed' || b.status === 'payment_failed')) {
        const r = await cancelAcademy(p, { bookingId: b.id, cancel: 'booking', by: 'coach', outcome: 'refund', reason: reason || 'The small group couldn’t go ahead', actorId: by })
        if (!r.ok) {
          // Nothing to refund (e.g. a weekly plan with nothing charged yet) — cancel without money back
          const r2 = await cancelAcademy(p, { bookingId: b.id, cancel: 'booking', by: 'coach', outcome: 'none', reason: reason || 'The small group couldn’t go ahead', actorId: by })
          if (!r2.ok) problems.push(`${inv.invitee.playerFirstName}: ${r.error}`)
        }
      }
    } else if (inv.status === 'invited') {
      await releaseHeld(p, inv)
      try {
        await sendEmail(p, {
          to: inv.invitee.email,
          subject: `${inv.invitee.playerFirstName}’s small group won’t go ahead`,
          html: emailLayout('academy', [{ heading: 'This small group won’t go ahead', intro: `Hi ${esc(inv.invitee.parentFirstName)}, the small group for ${esc(inv.invitee.playerFirstName)} on ${esc(groupWhen(g))} won’t be going ahead, so there’s nothing to pay. Sorry for the change — reply to this email if you’d like help finding another time.` }]),
          sender: 'academy',
          userId: rel(inv.account) ?? undefined,
        })
      } catch (e) {
        p.logger.error({ err: e, msg: `Cancel notice failed for invite ${inv.id}` })
      }
    }
    await p.update({ collection: 'academy-group-invites', id: inv.id, ...q, data: { status: isPaid(inv) || inv.status === 'overdue' ? inv.status : 'removed' } })
  }
  await releaseGroup(p, g.id, { by, note: reason || 'Cancelled by the coach' })
  return { problems }
}

/**
 * Only one player has paid: cancel the group (their family is refunded in full, anyone else is told) and
 * hold the same time for them as a 1-on-1 at the normal 1-on-1 price — a coach share link, so they book
 * and pay the usual way. Net, they pay the difference.
 */
export async function offerOneOnOne(p: Payload, coach: AcademyCoach, user: User, groupId: number) {
  const g = await ownGroup(p, coach.id, groupId)
  const invites = await groupInvites(p, g.id)
  const paid = invites.filter(isPaid)
  if (paid.length !== 1) throw new GroupError('This is for when exactly one player has paid.')
  const keep = paid[0]
  const { term } = await context(p, g)
  const oneOnOne = g.type === 'term' ? term.pricePerSession : term.casualPrice
  const { problems } = await cancelWholeGroup(p, coach.id, groupId, user.id, `The small group couldn’t go ahead — ${keep.invitee.playerFirstName} has been offered a 1-on-1 at the same time instead.`)
  const { createShareLink, ShareLinkError } = await import('./share-links')
  const i = keep.invitee
  try {
    const r = await createShareLink(p, {
      coach,
      user,
      mode: g.type,
      ...(g.type === 'term' ? { weekday: g.weekday ?? undefined, startTime: g.startTime ?? undefined } : { startsAt: g.firstSessionAt }),
      client: { firstName: i.parentFirstName, lastName: i.parentLastName, email: i.email, mobile: i.mobile ?? undefined, playerFirstName: i.playerFirstName },
      message: `The small group couldn’t go ahead, so your payment has been refunded in full. I’ve held the same time for ${i.playerFirstName} as a 1-on-1 instead (${g.type === 'term' ? `${formatPrice(oneOnOne)} a session` : formatPrice(oneOnOne)}) — book it here if you’d like it.`,
      holdHours: Math.min(term.shareLinkHoldHours ?? 48, 72),
      viaEmail: true,
      viaSms: Boolean(i.mobile),
    })
    return { player: i.playerFirstName, held: Boolean(r.link.holdUntil), problems }
  } catch (e) {
    if (e instanceof ShareLinkError) throw new GroupError(`The group is cancelled and ${i.playerFirstName}’s family refunded, but the 1-on-1 couldn’t be held: ${e.message} Send them a share link for another time.`)
    throw e
  }
}

const formatPrice = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n)
