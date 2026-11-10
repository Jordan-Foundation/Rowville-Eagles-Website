import { allowsWeekly } from './timeframes'
import type { Payload } from 'payload'
import type { AcademyCoach, AcademyGroup, AcademyGroupInvite, AcademyTerm, Participant, User } from '@/payload-types'
import { emailLayout, esc } from '../lib/email-templates'
import { sendEmail } from '../lib/email'
import { formatAUD, formatDate } from '../lib/format'
import { siteUrl } from '../lib/payments'
import { sendSms } from '../lib/sms'
import { coachOpenSlots } from './share-links'
import { hashShareToken, newShareToken, validShareToken } from './share-rules'
import { groupQuote, groupSettings } from './group-pricing'
import { firstNamesList, groupDeadline, type RosterPlayer } from './group-rules'
import { createGroupHold, groupSlots, releaseGroup } from './group-holds'

const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null | undefined) ?? null)
const q = { overrideAccess: true } as const
export class GroupError extends Error {}

export const groupInviteUrl = (token: string) => `${siteUrl()}/academy/group/${token}`
const when = (iso: string) => formatDate(iso, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })
const short = (iso: string) => formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const time = (iso: string) => formatDate(iso, { hour: 'numeric', minute: '2-digit' })

/** "Thursday 18 February, 4:00 pm" or "Thursdays at 4:00 pm, from 18 Feb (8 sessions)". */
export function groupWhen(g: Pick<AcademyGroup, 'type' | 'weekday' | 'firstSessionAt' | 'sessionsTotal'>) {
  return g.type === 'term'
    ? `${g.weekday}s at ${time(g.firstSessionAt)}, from ${formatDate(g.firstSessionAt, { day: 'numeric', month: 'short' })} (${g.sessionsTotal} sessions)`
    : when(g.firstSessionAt)
}

/** "Small group (3) with Coach Sam". */
export const groupTitle = (size: number, coachName: string) => `Small group (${size}) with ${coachName}`

/** The player and parent behind each roster entry (existing players use their family account's details). */
export async function resolveRoster(p: Payload, players: RosterPlayer[]) {
  const ids = players.flatMap((x) => (x.kind === 'existing' ? [x.participantId] : []))
  const { docs } = ids.length ? await p.find({ pagination: false, collection: 'participants', where: { id: { in: ids } }, depth: 1, limit: ids.length, ...q }) : { docs: [] as Participant[] }
  return players.map((x, i) => {
    if (x.kind === 'new') return { participant: undefined, account: undefined, invitee: { playerFirstName: x.playerFirstName, playerLastName: x.playerLastName, parentFirstName: x.parentFirstName, parentLastName: x.parentLastName, email: x.email, mobile: x.mobile } }
    const kid = docs.find((d) => d.id === x.participantId)
    if (!kid) throw new GroupError(`Player ${i + 1} couldn’t be found — search again.`)
    const parent = kid.account && typeof kid.account === 'object' ? (kid.account as User) : null
    if (!parent?.email) throw new GroupError(`${kid.firstName} ${kid.lastName} has no parent email on file — add them as a new player instead.`)
    return {
      participant: kid.id,
      account: parent.id,
      invitee: { playerFirstName: kid.firstName ?? '', playerLastName: kid.lastName ?? '', parentFirstName: parent.firstName || 'there', parentLastName: parent.lastName || '', email: parent.email, mobile: parent.phone?.replace(/\s+/g, '') || undefined },
    }
  })
}

export type NewGroup = {
  coach: AcademyCoach
  user: User
  type: 'casual' | 'term'
  startsAt?: string
  weekday?: string
  startTime?: string
  players: RosterPlayer[]
  message?: string
}

/** The sessions and term for a chosen time, checked against this coach's open times. */
export async function groupSessionsFor(p: Payload, coachId: number, o: { type: 'casual' | 'term'; startsAt?: string; weekday?: string; startTime?: string }) {
  const open = await coachOpenSlots(p, coachId)
  if (!open) throw new GroupError('There’s no open term to book into.')
  if (o.type === 'casual') {
    const at = o.startsAt && open.casual.find((c) => new Date(c).getTime() === new Date(o.startsAt!).getTime())
    if (!at) throw new GroupError('That time isn’t free any more — choose another.')
    return { term: open.term, dates: [new Date(at).toISOString()], weekday: undefined, startTime: undefined }
  }
  if (!allowsWeekly(open.term)) throw new GroupError('Weekly small groups aren’t available in the school holidays — set up a one-off group instead.')
  const w = open.weekly.find((x) => x.weekday === o.weekday && x.time === o.startTime)
  if (!w) throw new GroupError('That weekly time isn’t free any more — choose another.')
  return { term: open.term, dates: w.sessions, weekday: w.weekday, startTime: w.time }
}

/**
 * Set up a group: hold the coach's time until the payment deadline, then give each family its own
 * link by email and text. Prices come from the settings now and are locked on the group.
 */
export async function createGroup(p: Payload, o: NewGroup) {
  const { term, dates, weekday, startTime } = await groupSessionsFor(p, o.coach.id, o)
  const roster = await resolveRoster(p, o.players)
  const size = roster.length
  const gs = groupSettings(await p.findGlobal({ slug: 'academy-settings', depth: 0, ...q }))
  const quote = groupQuote(gs, size, o.type, dates.length)
  const now = new Date()
  const deadline = groupDeadline({ now, firstSessionAt: dates[0], hours: gs.inviteDeadlineHours, cutoffHours: term.bookingCutoffHours ?? 24 })
  if (!deadline) throw new GroupError('That’s too soon for families to pay — choose a later time.')

  const hold = await createGroupHold(p, {
    coach: o.coach.id,
    term: term.id,
    type: o.type,
    dates,
    weekday: weekday as AcademyGroup['weekday'],
    startTime,
    plannedSize: size,
    pricingSize: size,
    ratePerPlayer: quote.rate,
    paymentDeadline: deadline.toISOString(),
    createdBy: o.user.id,
  })
  if (!hold.ok) throw new GroupError('You already have something booked at that time — choose another.')
  const group = hold.group

  try {
    const made: { invite: AcademyGroupInvite; token: string }[] = []
    for (const r of roster) {
      const token = newShareToken()
      const invite = await p.create({
        collection: 'academy-group-invites',
        ...q,
        data: { group: group.id, tokenHash: hashShareToken(token), status: 'invited', participant: r.participant, account: r.account, invitee: r.invitee, rateLocked: quote.rate, termAnswer: 'pending' },
      })
      made.push({ invite, token })
    }
    const results = []
    for (const m of made) {
      const others = made.filter((x) => x !== m).map((x) => x.invite.invitee.playerFirstName)
      const sent = await sendGroupInvite(p, { group, invite: m.invite, token: m.token, coach: o.coach, term, others, message: o.message })
      results.push({ invite: m.invite, url: groupInviteUrl(m.token), ...sent })
    }
    return { group, quote, invites: results }
  } catch (e) {
    await releaseGroup(p, group.id, { by: o.user.id, note: 'Couldn’t send the invites' })
    throw e
  }
}

/** Email and text one family their own link (never anyone else's details — other players' first names only). */
export async function sendGroupInvite(
  p: Payload,
  o: { group: AcademyGroup; invite: AcademyGroupInvite; token: string; coach: AcademyCoach; term: AcademyTerm; others: string[]; message?: string; reminder?: boolean },
) {
  const { group: g, invite: inv } = o
  const i = inv.invitee
  const url = groupInviteUrl(o.token)
  const total = inv.rateLocked * g.sessionsTotal
  const withWho = o.others.length ? ` with ${firstNamesList(o.others)}` : ''
  const deadline = g.paymentDeadline ? short(g.paymentDeadline) : null
  let sentEmail = false
  let sentSms = false
  const html = emailLayout('academy', [{
    heading: o.reminder ? `Reminder: ${i.playerFirstName}’s small group` : `${o.coach.displayName} has a small group spot for ${i.playerFirstName}`,
    intro: `Hi ${esc(i.parentFirstName)},${o.message ? `<br><br><em>${esc(o.message)}</em><br>— ${esc(o.coach.displayName)}` : ''}<br><br>${esc(`${i.playerFirstName} is invited to a small group session${withWho}.`)}${deadline ? `<br><br><strong>${esc(`Please pay by ${deadline} to keep ${i.playerFirstName}’s place.`)}</strong>` : ''}`,
    rows: [
      ['Coach', o.coach.displayName],
      [g.type === 'term' ? 'Weekly' : 'When', groupWhen(g)],
      ['Group', `${g.plannedSize} players`],
      ['Where', o.term.location || ''],
      ['Price', g.type === 'term' ? `${formatAUD(inv.rateLocked)} a session (${formatAUD(total)} for the term)` : formatAUD(inv.rateLocked)],
    ],
    cta: { label: o.reminder ? 'Pay now' : 'View and pay', href: url },
    after: 'Each family pays for their own player. The link is just for you — please don’t forward it.',
  }])
  await sendEmail(p, { to: i.email, subject: o.reminder ? `Reminder: pay by ${deadline} for ${i.playerFirstName}’s small group` : `${o.coach.displayName} has a small group spot for ${i.playerFirstName}`, html, sender: 'academy', userId: rel(inv.account) ?? undefined })
  sentEmail = true
  if (i.mobile) {
    const user = rel(inv.account)
      ? await p.findByID({ collection: 'users', id: rel(inv.account)!, depth: 0, ...q, disableErrors: true })
      : (await p.find({ pagination: false, collection: 'users', where: { email: { equals: i.email.toLowerCase() } }, limit: 1, depth: 0, ...q })).docs[0]
    const r = await sendSms(p, {
      to: i.mobile,
      kind: o.reminder ? 'reminder' : 'service',
      optedOut: user?.smsOptOut,
      userId: user?.id,
      body: o.reminder
        ? `Hi ${i.parentFirstName}, a reminder to pay for ${i.playerFirstName}’s Foundation Academy small group with ${o.coach.displayName} by ${deadline}: ${url}`
        : `Hi ${i.parentFirstName}, ${o.coach.displayName} from Foundation Academy has a small group spot for ${i.playerFirstName}${withWho}: ${g.type === 'term' ? groupWhen(g) : short(g.firstSessionAt)}. ${formatAUD(inv.rateLocked)}/session.${deadline ? ` Pay by ${deadline}:` : ''} ${url}`,
    })
    sentSms = r.sent
  }
  await p.update({ collection: 'academy-group-invites', id: inv.id, ...q, data: o.reminder ? { remindedAt: new Date().toISOString() } : { sentEmail, sentSms } })
  return { sentEmail, sentSms }
}

/** A family's invite from its secret link, with its group (null if unknown). */
export async function findGroupInvite(p: Payload, token: string | null | undefined) {
  if (!token || !validShareToken(token)) return null
  const hash = hashShareToken(token)
  const { docs } = await p.find({ pagination: false, collection: 'academy-group-invites', where: { or: [{ tokenHash: { equals: hash } }, { altTokenHash: { equals: hash } }] }, limit: 1, depth: 0, ...q })
  const invite = docs[0]
  if (!invite) return null
  const group = await p.findByID({ collection: 'academy-groups', id: rel(invite.group)!, depth: 0, ...q, disableErrors: true })
  return group ? { invite, group } : null
}

/** Everyone in a group (removed players left out), in the order they were added. */
export async function groupInvites(p: Payload, groupId: number) {
  const { docs } = await p.find({ pagination: false, collection: 'academy-group-invites', where: { group: { equals: groupId }, status: { not_equals: 'removed' } }, sort: 'createdAt', limit: 20, depth: 0, ...q })
  return docs
}

/** This coach's groups that haven't finished, soonest first, with each player's place. */
export async function coachGroupList(p: Payload, coachId: number) {
  const { docs } = await p.find({
    pagination: false,
    collection: 'academy-groups',
    where: { coach: { equals: coachId }, status: { in: ['forming', 'confirmed', 'shortfall'] } },
    sort: 'firstSessionAt',
    limit: 100,
    depth: 0,
    ...q,
  })
  const invites = docs.length ? (await p.find({ pagination: false, collection: 'academy-group-invites', where: { group: { in: docs.map((g) => g.id) }, status: { not_equals: 'removed' } }, sort: 'createdAt', limit: 500, depth: 0, ...q })).docs : []
  return docs.map((g) => ({ group: g, invites: invites.filter((i) => rel(i.group) === g.id) }))
}

/** One of this coach's groups (null if it isn't theirs). */
export async function loadCoachGroup(p: Payload, coachId: number, id: number) {
  const group = await p.findByID({ collection: 'academy-groups', id, depth: 0, ...q, disableErrors: true })
  if (!group || rel(group.coach) !== coachId) return null
  const [invites, slots] = await Promise.all([groupInvites(p, id), groupSlots(p, id)])
  return { group, invites, slots }
}
