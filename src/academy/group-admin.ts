import type { Payload } from 'payload'
import { commitTransaction, createLocalReq, initTransaction, killTransaction } from 'payload'
import type { AcademyCoach, AcademyGroup, User } from '@/payload-types'
import { emailLayout, esc } from '../lib/email-templates'
import { sendEmail } from '../lib/email'
import { formatDate } from '../lib/format'
import { siteUrl } from '../lib/payments'
import { hashShareToken, newShareToken } from './share-rules'
import { GROUP_MAX } from './group-pricing'
import type { RosterPlayer } from './group-rules'
import { coachClashes, isSlotClash } from './group-holds'
import { GroupError, groupInvites, groupWhen, resolveRoster, sendGroupInvite } from './groups'

const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null | undefined) ?? null)
const q = { overrideAccess: true } as const
const when = (iso: string) => formatDate(iso, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })
const history = (g: AcademyGroup, action: string, by?: number | null, note?: string) => [...(g.history ?? []), { at: new Date().toISOString(), by: by ?? undefined, action, note }]
const iso = (s: string) => new Date(s).toISOString()

/** A player's whole booking was cancelled: their place is removed and the group is one smaller. */
export async function leaveGroup(p: Payload, inviteId: number, by?: number | null) {
  const inv = await p.findByID({ collection: 'academy-group-invites', id: inviteId, depth: 0, ...q, disableErrors: true })
  if (!inv || inv.status === 'removed') return
  await p.update({ collection: 'academy-group-invites', id: inv.id, ...q, data: { status: 'removed' } })
  const g = await p.findByID({ collection: 'academy-groups', id: rel(inv.group)!, depth: 0, ...q })
  if (g.status === 'cancelled') return
  const left = (await groupInvites(p, g.id)).filter((i) => i.status !== 'declined').length
  await p.update({ collection: 'academy-groups', id: g.id, ...q, data: { plannedSize: Math.max(1, left), history: history(g, `${inv.invitee.playerFirstName} left the group`, by) } })
}

/** The player sessions and the group's own time row at one date. */
async function rowsAt(p: Payload, groupId: number, startsAt: string) {
  const { docs } = await p.find({ pagination: false, collection: 'academy-sessions', where: { group: { equals: groupId }, startsAt: { equals: iso(startsAt) }, status: { in: ['held', 'scheduled'] } }, limit: 20, depth: 0, ...q })
  return { players: docs.filter((s) => s.kind === 'group-player'), slot: docs.find((s) => s.kind === 'group-slot') ?? null }
}

/**
 * Cancel one date for the whole group (e.g. the coach can't make it): each family gets the session's value
 * back as a refund or a small group credit, through the normal cancellation on their own booking.
 */
export async function cancelGroupDate(p: Payload, o: { groupId: number; startsAt: string; outcome: 'refund' | 'credit'; reason: string; actorId: number }) {
  const g = await p.findByID({ collection: 'academy-groups', id: o.groupId, depth: 0, ...q })
  if (new Date(o.startsAt) <= new Date()) throw new GroupError('That session has already started.')
  if (!o.reason.trim()) throw new GroupError('Please give a reason — families are told.')
  const { players, slot } = await rowsAt(p, g.id, o.startsAt)
  if (!players.length && !slot) throw new GroupError('Nothing booked at that time.')
  const { cancelAcademy } = await import('./cancellations')
  const done: string[] = []
  const problems: string[] = []
  for (const s of players) {
    const r = await cancelAcademy(p, { bookingId: rel(s.booking)!, cancel: [s.id], by: 'coach', outcome: o.outcome, reason: o.reason, actorId: o.actorId, keepGroupPlace: true })
    if (r.ok) done.push(String(s.id))
    else {
      // A weekly week not charged yet can't be refunded — give the credit instead
      const r2 = o.outcome === 'refund' ? await cancelAcademy(p, { bookingId: rel(s.booking)!, cancel: [s.id], by: 'coach', outcome: 'credit', reason: o.reason, actorId: o.actorId, keepGroupPlace: true }) : r
      if (r2.ok) done.push(String(s.id))
      else problems.push(r.error)
    }
  }
  if (slot) await p.update({ collection: 'academy-sessions', id: slot.id, ...q, data: { status: 'cancelled', cancelledBy: 'coach', cancelledAt: new Date().toISOString(), cancelReason: o.reason } })
  await p.update({ collection: 'academy-groups', id: g.id, ...q, data: { history: history(g, `Session on ${when(o.startsAt)} cancelled (${o.outcome === 'refund' ? 'refunds' : 'small group credit'})`, o.actorId, o.reason) } })
  return { players: done.length, problems }
}

/**
 * Move one date for the whole group (every player's session and the group's time together). The coach
 * must be free at the new time; families and the coach are emailed.
 */
export async function moveGroupDate(p: Payload, o: { groupId: number; from: string; to: string; actorId: number; notify?: boolean }) {
  const g = await p.findByID({ collection: 'academy-groups', id: o.groupId, depth: 1, ...q })
  const to = iso(o.to)
  if (new Date(o.from) <= new Date()) throw new GroupError('That session has already started.')
  if (new Date(to) <= new Date()) throw new GroupError('Choose a future date and time.')
  if (to === iso(o.from)) throw new GroupError('That’s the same time.')
  const coach = g.coach as AcademyCoach
  const { players, slot } = await rowsAt(p, g.id, o.from)
  if (!slot && !players.length) throw new GroupError('Nothing booked at that time.')
  if ((await coachClashes(p, coach.id, [to])).length) throw new GroupError(`${coach.displayName} already has a session at that time.`)
  const req = await createLocalReq({}, p)
  await initTransaction(req)
  try {
    if (slot) await p.update({ collection: 'academy-sessions', id: slot.id, ...q, req, data: { startsAt: to } })
    for (const s of players) await p.update({ collection: 'academy-sessions', id: s.id, ...q, req, data: { startsAt: to } })
    if (iso(g.firstSessionAt) === iso(o.from)) await p.update({ collection: 'academy-groups', id: g.id, ...q, req, data: { firstSessionAt: to } })
    await commitTransaction(req)
  } catch (e) {
    await killTransaction(req)
    if (isSlotClash(e)) throw new GroupError(`${coach.displayName} already has a session at that time.`)
    throw e
  }
  await p.update({ collection: 'academy-groups', id: g.id, ...q, data: { history: history(g, `Session moved from ${when(o.from)} to ${when(to)}`, o.actorId) } })
  if (o.notify !== false) {
    const invites = (await groupInvites(p, g.id)).filter((i) => i.status === 'paid' || i.status === 'weekly')
    for (const inv of invites) {
      try {
        await sendEmail(p, {
          to: inv.invitee.email,
          subject: `${inv.invitee.playerFirstName}’s small group has moved to ${when(to)}`,
          html: emailLayout('academy', [{ heading: 'Your small group session has moved', intro: `Hi ${esc(inv.invitee.parentFirstName)}, ${esc(inv.invitee.playerFirstName)}’s small group with ${esc(coach.displayName)} on ${esc(when(o.from))} has moved to <strong>${esc(when(to))}</strong>. Nothing else changes. Reply to this email if the new time doesn’t suit.` }]),
          sender: 'academy',
          userId: rel(inv.account) ?? undefined,
        })
      } catch (e) {
        p.logger.error({ err: e, msg: `Move notice failed for invite ${inv.id}` })
      }
    }
    const user = typeof coach.user === 'object' ? (coach.user as User) : null
    if (user) await sendEmail(p, { to: user.email, subject: `Small group moved to ${when(to)}`, html: emailLayout('academy', [{ heading: 'A small group session has moved', intro: `Your small group on ${esc(when(o.from))} has moved to <strong>${esc(when(to))}</strong>.`, cta: { label: 'Open the group', href: `${siteUrl()}/coach/sessions/group/${g.id}` } }]), sender: 'academy', userId: user.id })
  }
  return { moved: players.length }
}

/** Cover for one date of the group: flag it (coach away) and/or assign the cover coach — all rows together. */
export async function setGroupCover(p: Payload, o: { groupId: number; startsAt: string; needsCover: boolean; coverCoach?: number | null; note?: string; actorId?: number }) {
  const { players, slot } = await rowsAt(p, o.groupId, o.startsAt)
  const rows = [...players, ...(slot ? [slot] : [])]
  if (!rows.length) throw new GroupError('Nothing booked at that time.')
  for (const s of rows) {
    await p.update({ collection: 'academy-sessions', id: s.id, ...q, data: { needsCover: o.needsCover, ...(o.coverCoach !== undefined ? { coverCoach: o.coverCoach } : {}), ...(o.note ? { coverNote: o.note } : {}) } })
  }
  const g = await p.findByID({ collection: 'academy-groups', id: o.groupId, depth: 0, ...q })
  await p.update({ collection: 'academy-groups', id: g.id, ...q, data: { history: history(g, o.coverCoach ? `Cover coach assigned for ${when(o.startsAt)}` : o.needsCover ? `Cover needed for ${when(o.startsAt)}` : `Cover cleared for ${when(o.startsAt)}`, o.actorId, o.note) } })
  return rows.length
}

/**
 * Add a player to a running group: they pay the group's price per player for the sessions left
 * (everyone else keeps theirs). Up to 5 players.
 */
export async function addGroupPlayer(p: Payload, coach: AcademyCoach, groupId: number, player: RosterPlayer, by: number) {
  const g = await p.findByID({ collection: 'academy-groups', id: groupId, depth: 0, ...q, disableErrors: true })
  if (!g || rel(g.coach) !== coach.id) throw new GroupError('Group not found.')
  if (g.status !== 'forming' && g.status !== 'confirmed') throw new GroupError('Players can only be added while the group is running.')
  const everyone = await groupInvites(p, g.id)
  const inGroup = everyone.filter((i) => i.status !== 'declined')
  if (inGroup.length >= GROUP_MAX) throw new GroupError(`A small group is at most ${GROUP_MAX} players.`)
  const { docs: future } = await p.find({ pagination: false, collection: 'academy-sessions', where: { group: { equals: g.id }, kind: { equals: 'group-slot' }, status: { not_equals: 'cancelled' }, startsAt: { greater_than: new Date().toISOString() } }, limit: 1, depth: 0, ...q })
  if (!future.length) throw new GroupError('There are no sessions left in this group.')
  const [r] = await resolveRoster(p, [player])
  if (r.participant && inGroup.some((i) => rel(i.participant) === r.participant)) throw new GroupError('That player is already in the group.')
  const token = newShareToken()
  const invite = await p.create({
    collection: 'academy-group-invites',
    ...q,
    data: { group: g.id, tokenHash: hashShareToken(token), status: 'invited', participant: r.participant, account: r.account, invitee: r.invitee, rateLocked: g.ratePerPlayer, termAnswer: 'pending' },
  })
  const updated = await p.update({ collection: 'academy-groups', id: g.id, ...q, data: { plannedSize: inGroup.length + 1, history: history(g, `${r.invitee.playerFirstName} added`, by) } })
  const term = await p.findByID({ collection: 'academy-terms', id: rel(g.term)!, depth: 0, ...q })
  const others = inGroup.map((i) => i.invitee.playerFirstName)
  return sendGroupInvite(p, { group: updated, invite, token, coach, term, others })
}

/** Coach: "I need cover" for a whole group date — flags every row and tells the Academy. */
export async function coachNeedsGroupCover(p: Payload, coach: AcademyCoach, groupId: number, startsAt: string, note: string) {
  const g = await p.findByID({ collection: 'academy-groups', id: groupId, depth: 0, ...q, disableErrors: true })
  if (!g || rel(g.coach) !== coach.id) throw new GroupError('Only the group’s coach can ask for cover.')
  if (new Date(startsAt) <= new Date()) throw new GroupError('This session has already started.')
  await setGroupCover(p, { groupId, startsAt, needsCover: true, note })
  const { academyBrand } = await import('./brand')
  await sendEmail(p, {
    to: academyBrand.email,
    subject: `Cover needed: small group with ${coach.displayName}, ${when(startsAt)}`,
    html: emailLayout('academy', [{ heading: 'Cover needed for a small group', intro: `${esc(coach.displayName)} needs cover for their small group (${esc(groupWhen(g))}) on <strong>${esc(when(startsAt))}</strong>.${note ? `<br><br>${esc(note)}` : ''}`, cta: { label: 'Assign cover', href: `${siteUrl()}/management/academy/groups/${g.id}` } }]),
    sender: 'academy',
  })
}
