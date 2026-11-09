import type { Payload } from 'payload'
import type { AcademyBooking, AcademyCoach, AcademyGroup, User } from '@/payload-types'
import { emailLayout, esc } from '../lib/email-templates'
import { sendEmail } from '../lib/email'
import { formatAUD } from '../lib/format'
import { siteUrl } from '../lib/payments'
import { sendSms } from '../lib/sms'
import { scheduleGroupSlots } from './group-holds'
import { groupTitle, groupWhen } from './groups'

const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null | undefined) ?? null)
const q = { overrideAccess: true } as const

/** A player's place follows their own booking: paid, paying weekly, or overdue when a weekly charge fails. */
export function placeStatusFor(b: Pick<AcademyBooking, 'status' | 'paymentMode'>): 'paid' | 'weekly' | 'overdue' | null {
  if (b.status === 'payment_failed') return 'overdue'
  if (b.status === 'confirmed' || b.status === 'completed') return b.paymentMode === 'weekly' ? 'weekly' : 'paid'
  return null
}

const history = (g: AcademyGroup, action: string, note?: string) => [...(g.history ?? []), { at: new Date().toISOString(), action, note }]

/**
 * Called whenever a group player's booking is confirmed or a weekly payment succeeds or fails: update their
 * place, and confirm the group once everyone still in it has paid.
 */
export async function syncGroupPlace(p: Payload, booking: AcademyBooking) {
  if (booking.kind !== 'group' || !rel(booking.groupInvite)) return
  const status = placeStatusFor(booking)
  if (!status) return
  const invite = await p.findByID({ collection: 'academy-group-invites', id: rel(booking.groupInvite)!, depth: 0, ...q, disableErrors: true })
  if (!invite || invite.status === 'removed' || invite.status === 'declined') return
  if (invite.status !== status) await p.update({ collection: 'academy-group-invites', id: invite.id, ...q, data: { status, booking: booking.id } })
  await confirmGroupIfComplete(p, rel(invite.group)!)
}

/**
 * Everyone in the group has paid (upfront or weekly) → the group is confirmed and the coach is told.
 * A declined place keeps the group waiting: the coach decides what happens (invite someone else, go ahead
 * smaller — which removes the place — or cancel).
 */
export async function confirmGroupIfComplete(p: Payload, groupId: number) {
  const group = await p.findByID({ collection: 'academy-groups', id: groupId, depth: 0, ...q, disableErrors: true })
  if (!group || (group.status !== 'forming' && group.status !== 'shortfall')) return false
  const { docs: invites } = await p.find({ pagination: false, collection: 'academy-group-invites', where: { group: { equals: groupId }, status: { not_equals: 'removed' } }, limit: 20, depth: 0, ...q })
  if (!invites.length || !invites.every((i) => i.status === 'paid' || i.status === 'weekly')) return false
  // Claim the change so two payments landing together only confirm (and alert) once
  const { docs: claimed } = await p.update({ collection: 'academy-groups', where: { id: { equals: groupId }, status: { in: ['forming', 'shortfall'] } }, ...q, data: { status: 'confirmed', history: history(group, 'Group confirmed — everyone has paid') } })
  if (!claimed.length) return false
  await scheduleGroupSlots(p, groupId)
  try {
    await alertCoachGroupConfirmed(p, claimed[0], invites.map((i) => `${i.invitee.playerFirstName} ${i.invitee.playerLastName}`))
  } catch (e) {
    p.logger.error({ err: e, msg: `Group confirmed alert failed for ${group.reference}` })
  }
  return true
}

async function alertCoachGroupConfirmed(p: Payload, g: AcademyGroup, players: string[]) {
  const coach = (await p.findByID({ collection: 'academy-coaches', id: rel(g.coach)!, depth: 1, ...q })) as AcademyCoach
  const user = typeof coach.user === 'object' ? (coach.user as User) : null
  if (!user) return
  const title = groupTitle(players.length, coach.displayName)
  const link = `${siteUrl()}/coach/sessions/group/${g.id}`
  const html = emailLayout('academy', [{
    heading: 'Your small group is confirmed',
    intro: `Everyone has paid — ${esc(title.replace(/ with .*/, ''))} is going ahead.`,
    rows: [
      ['When', groupWhen(g)],
      ['Players', players.join(', ')],
      ['Price per player', `${formatAUD(g.ratePerPlayer)} a session`],
      ['Reference', g.reference],
    ],
    cta: { label: 'Open the group', href: link },
  }])
  if (coach.alerts?.bookingEmail !== false) await sendEmail(p, { to: user.email, subject: `Small group confirmed: ${players.map((x) => x.split(' ')[0]).join(', ')} — ${groupWhen(g)}`, html, sender: 'academy', userId: user.id })
  if (coach.alerts?.bookingText !== false) await sendSms(p, { to: user.phone, kind: 'coach_alert', optedOut: user.smsOptOut, body: `Foundation Academy: your small group (${players.length}) is confirmed — everyone has paid. ${groupWhen(g)}. ${link}` })
}

/** The family can't make it: their place is declined, any checkout in progress is let go, the coach is told. */
export async function declineGroupInvite(p: Payload, inviteId: number) {
  const invite = await p.findByID({ collection: 'academy-group-invites', id: inviteId, depth: 0, ...q })
  if (invite.status !== 'invited' && invite.status !== 'overdue') return invite
  const { releaseBooking } = await import('./booking-data')
  const held = rel(invite.booking) ? await p.findByID({ collection: 'academy-bookings', id: rel(invite.booking)!, depth: 0, ...q, disableErrors: true }) : null
  if (held?.status === 'held') await releaseBooking(p, held, 'cancelled')
  const updated = await p.update({ collection: 'academy-group-invites', id: invite.id, ...q, data: { status: 'declined' } })
  const group = await p.findByID({ collection: 'academy-groups', id: rel(invite.group)!, depth: 0, ...q })
  await p.update({ collection: 'academy-groups', id: group.id, ...q, data: { history: history(group, 'Family declined', `${invite.invitee.playerFirstName} ${invite.invitee.playerLastName}`) } })
  try {
    const coach = (await p.findByID({ collection: 'academy-coaches', id: rel(group.coach)!, depth: 1, ...q })) as AcademyCoach
    const user = typeof coach.user === 'object' ? (coach.user as User) : null
    if (user) {
      const link = `${siteUrl()}/coach/sessions/group/${group.id}`
      const who = `${invite.invitee.playerFirstName} ${invite.invitee.playerLastName}`
      await sendEmail(p, {
        to: user.email,
        subject: `${invite.invitee.playerFirstName} can’t make your small group — ${groupWhen(group)}`,
        html: emailLayout('academy', [{ heading: 'A family has declined', intro: `${esc(who)}’s family can’t make the small group on ${esc(groupWhen(group))}. Open the group to decide what happens next.`, cta: { label: 'Open the group', href: link } }]),
        sender: 'academy',
        userId: user.id,
      })
      if (coach.alerts?.bookingText !== false) await sendSms(p, { to: user.phone, kind: 'coach_alert', optedOut: user.smsOptOut, body: `Foundation Academy: ${who} can’t make your small group (${groupWhen(group)}). ${link}` })
    }
  } catch (e) {
    p.logger.error({ err: e, msg: `Decline alert failed for invite ${invite.id}` })
  }
  return updated
}
