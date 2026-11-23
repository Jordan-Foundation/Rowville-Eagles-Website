import { randomBytes } from 'crypto'
import type { Payload } from 'payload'
import type { Participant, RfaTournament, TournamentInvite, TournamentSquad, User } from '@/payload-types'
import { sendEmail } from '../lib/email'
import { emailLayout } from '../lib/email-templates'
import { siteUrl } from '../lib/payments'
import { formatDate } from '../lib/format'
import { birthYearOf } from '../lib/age-groups'

const q = { overrideAccess: true, depth: 0 } as const
const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : ((v as number | null | undefined) ?? null))
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export class TournamentError extends Error {}

/** Places taken in a squad: accepted (fee to pay) and confirmed — plus invites still waiting for an answer. */
export function squadCounts(invites: Pick<TournamentInvite, 'status'>[]) {
  const n = (s: string) => invites.filter((i) => i.status === s).length
  return { invited: invites.length, accepted: n('accepted') + n('paid'), paid: n('paid'), declined: n('declined'), noResponse: n('invited'), expired: n('expired') }
}
/** How many more players can be invited without going over the squad size (outstanding invites count). */
export const openPlaces = (limit: number, invites: Pick<TournamentInvite, 'status'>[]) => Math.max(0, limit - invites.filter((i) => ['invited', 'accepted', 'paid'].includes(i.status)).length)

export const inviteUrl = (inv: Pick<TournamentInvite, 'token'>) => `${siteUrl()}/tournaments/invite/${inv.token}`
const dateRange = (t: RfaTournament) => (t.endDate && t.endDate.slice(0, 10) !== t.startDate.slice(0, 10) ? `${formatDate(t.startDate, { weekday: 'short', day: 'numeric', month: 'short' })} – ${formatDate(t.endDate, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}` : formatDate(t.startDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
export const squadLimit = (t: Pick<RfaTournament, 'squadSize'>, s: Pick<TournamentSquad, 'limit'>) => s.limit || t.squadSize || 10

function detailRows(t: RfaTournament, s: TournamentSquad): [string, string][] {
  return [
    ['Tournament', t.name],
    ['Squad', s.name],
    ['When', dateRange(t)],
    ...(t.arrivalTime ? ([['Arrive', t.arrivalTime]] as [string, string][]) : []),
    ...(t.venue ? ([['Where', t.venue]] as [string, string][]) : []),
    ['Fee', t.fee ? `$${t.fee.toFixed(2)}` : 'No fee'],
    ['Reply by', formatDate(t.rsvpDeadline, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })],
  ]
}

async function familyRecipients(p: Payload, accountId: number) {
  const parent = (await p.findByID({ collection: 'users', id: accountId, ...q })) as User
  const { docs: others } = await p.find({ ...q, collection: 'users', where: { familyAccount: { equals: accountId } }, limit: 5, pagination: false })
  return [parent, ...others]
}

/** Email (with Accept / Decline) + push to the family. */
async function sendInvite(p: Payload, inv: TournamentInvite, t: RfaTournament, s: TournamentSquad, kind: 'invite' | 'reminder') {
  const accountId = rel(inv.account)
  if (!accountId) return
  const url = inviteUrl(inv)
  const people = await familyRecipients(p, accountId)
  const first = (inv.playerName ?? '').split(' ')[0] || 'Your player'
  const heading = kind === 'reminder' ? `Reminder: please reply for ${first}` : `${first} is invited to ${t.name}`
  const intro = `${kind === 'reminder' ? 'We haven’t had a reply yet. ' : ''}We’d love ${esc(first)} to play for the Rowville Foundation Academy in <strong>${esc(s.name)}</strong> at ${esc(t.name)}. Please let us know by ${esc(formatDate(t.rsvpDeadline, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }))}.`
  const after = [
    `<p style="margin:0 0 12px"><a href="${url}?a=accept" style="display:inline-block;background:#000;color:#fff;font:bold 15px Arial,sans-serif;text-decoration:none;padding:12px 24px;margin-right:8px">Accept</a> <a href="${url}?a=decline" style="display:inline-block;border:2px solid #000;color:#000;font:bold 15px Arial,sans-serif;text-decoration:none;padding:10px 22px">Decline</a></p>`,
    t.whatToBring ? `<strong>What to bring</strong><br>${esc(t.whatToBring).replace(/\n/g, '<br>')}` : '',
    t.details ? esc(t.details).replace(/\n/g, '<br>') : '',
    t.fee ? `Accepting takes you to payment — ${esc(first)}’s place is confirmed once the fee is paid.` : '',
  ].filter(Boolean).join('<br><br>')
  for (const u of people) {
    await sendEmail(p, { to: u.email, subject: kind === 'reminder' ? `Reminder: ${t.name} — please reply for ${first}` : `${first} is invited to ${t.name}`, html: emailLayout('academy', [{ heading, intro, rows: detailRows(t, s), after }]), sender: 'academy', userId: u.id }).catch((e) => p.logger.error({ err: e, msg: `Tournament invite email ${inv.id} failed` }))
  }
  const { notifyMany } = await import('../lib/app-install')
  await notifyMany(p, people.map((u) => u.id), 'teams', { title: kind === 'reminder' ? `Reply for ${first}: ${t.name}` : `${first} is invited to ${t.name}`, body: `${s.name} · ${dateRange(t)}. Tap to accept or decline.`, url: `/tournaments/invite/${inv.token}`, tag: `tournament-invite-${inv.id}` })
}

/** Invite players to a squad (only up to the squad size, counting outstanding invites). */
export async function invitePlayers(p: Payload, squadId: number, participantIds: number[], by: User) {
  const s = (await p.findByID({ collection: 'tournament-squads', id: squadId, ...q })) as TournamentSquad
  const t = (await p.findByID({ collection: 'rfa-tournaments', id: rel(s.tournament)!, ...q })) as RfaTournament
  if (new Date(t.rsvpDeadline) < new Date()) throw new TournamentError('The RSVP deadline has passed — move it later to invite more players.')
  const { docs: existing } = await p.find({ ...q, collection: 'tournament-invites', where: { squad: { equals: squadId } }, limit: 500, pagination: false })
  const already = new Set(existing.map((i) => rel(i.participant)))
  const fresh = [...new Set(participantIds)].filter((id) => !already.has(id))
  const room = openPlaces(squadLimit(t, s), existing)
  if (fresh.length > room) throw new TournamentError(`Only ${room} place${room === 1 ? '' : 's'} left in ${s.name} (squad size ${squadLimit(t, s)}, counting invites waiting for a reply). Choose fewer players.`)
  const created: TournamentInvite[] = []
  for (const id of fresh) {
    const kid = (await p.findByID({ collection: 'participants', id, ...q })) as Participant
    const inv = await p.create({ ...q, collection: 'tournament-invites', data: { tournament: t.id, squad: s.id, participant: kid.id, account: rel(kid.account), playerName: `${kid.firstName} ${kid.lastName}`, birthYear: birthYearOf(kid.dateOfBirth), status: 'invited', token: randomBytes(18).toString('base64url'), invitedAt: new Date().toISOString(), invitedBy: by.id } })
    await sendInvite(p, inv, t, s, 'invite')
    created.push(inv)
  }
  return { invited: created.length, skipped: participantIds.length - created.length }
}

export async function inviteByToken(p: Payload, token: string) {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null
  const inv = (await p.find({ ...q, depth: 1, collection: 'tournament-invites', where: { token: { equals: token } }, limit: 1, pagination: false })).docs[0]
  if (!inv) return null
  return { inv, t: inv.tournament as RfaTournament, s: inv.squad as TournamentSquad }
}

/** Accept or decline. With a fee, accepting creates an invoice and returns its payment link. */
export async function respond(p: Payload, token: string, answer: 'accept' | 'decline', now = new Date()): Promise<{ status: TournamentInvite['status']; payUrl?: string }> {
  const found = await inviteByToken(p, token)
  if (!found) throw new TournamentError('This invite link isn’t valid.')
  const { inv, t, s } = found
  if (inv.status === 'accepted' && answer === 'accept' && inv.invoice) {
    const invoice = await p.findByID({ collection: 'invoices', id: rel(inv.invoice)!, ...q, showHiddenFields: true })
    return { status: 'accepted', payUrl: `/invoice/${invoice.reference}/${invoice.token}` }
  }
  if (inv.status !== 'invited') {
    const msg: Record<string, string> = { accepted: 'You’ve already accepted — thank you.', paid: 'You’re all confirmed — see you there!', declined: 'You’ve already declined this invite.', expired: 'The reply deadline has passed — contact the Academy if you’d still like to play.', withdrawn: 'This invite has been withdrawn.' }
    throw new TournamentError(msg[inv.status] ?? 'This invite has already been answered.')
  }
  if (new Date(t.rsvpDeadline) < now) {
    await p.update({ ...q, collection: 'tournament-invites', id: inv.id, data: { status: 'expired' } })
    throw new TournamentError('The reply deadline has passed — contact the Academy if you’d still like to play.')
  }
  if (answer === 'decline') {
    await p.update({ ...q, collection: 'tournament-invites', id: inv.id, data: { status: 'declined', respondedAt: now.toISOString() } })
    return { status: 'declined' }
  }
  // The squad size is never exceeded by acceptances
  const { docs: all } = await p.find({ ...q, collection: 'tournament-invites', where: { squad: { equals: s.id }, status: { in: ['accepted', 'paid'] } }, limit: 500, pagination: false })
  if (all.length >= squadLimit(t, s)) throw new TournamentError(`Sorry — ${s.name} is now full. The Academy will be in touch if a place comes up.`)
  if (!t.fee) {
    await p.update({ ...q, collection: 'tournament-invites', id: inv.id, data: { status: 'paid', respondedAt: now.toISOString(), paidAt: now.toISOString() } })
    return { status: 'paid' }
  }
  const { saveInvoice } = await import('../invoices/service')
  const invoice = await saveInvoice(p, { payee: 'academy', account: rel(inv.account), contactName: '', playerName: inv.playerName, items: [{ description: `${t.name} — ${s.name}`, quantity: 1, unitPrice: t.fee, source: `tournament-invite:${inv.id}` }], dueDate: t.rsvpDeadline, note: `${inv.playerName}’s place in ${s.name} is confirmed once this is paid.` })
  // Ready to pay straight away (the family is taken to it now — no separate invoice email)
  await p.update({ ...q, collection: 'invoices', id: invoice.id, data: { status: 'sent', sentAt: now.toISOString() } })
  await p.update({ ...q, collection: 'tournament-invites', id: inv.id, data: { status: 'accepted', respondedAt: now.toISOString(), invoice: invoice.id } })
  const fresh = await p.findByID({ collection: 'invoices', id: invoice.id, ...q, showHiddenFields: true })
  return { status: 'accepted', payUrl: `/invoice/${fresh.reference}/${fresh.token}` }
}

/** Called when an invoice is paid: confirms the tournament place it was for. */
export async function invoicePaid(p: Payload, invoice: { id: number; items?: { source?: string | null }[] | null }) {
  for (const it of invoice.items ?? []) {
    const m = it.source?.match(/^tournament-invite:(\d+)$/)
    if (!m) continue
    const inv = await p.findByID({ collection: 'tournament-invites', id: Number(m[1]), ...q, disableErrors: true })
    if (inv && inv.status !== 'paid') await p.update({ ...q, collection: 'tournament-invites', id: inv.id, data: { status: 'paid', paidAt: new Date().toISOString() } })
  }
}

/** Hourly: one reminder 48 hours before the deadline (no reply yet), then expire unanswered invites. Idempotent. */
export async function sweepInvites(p: Payload, now = new Date()) {
  const nowIso = now.toISOString()
  const { docs: open } = await p.find({ ...q, depth: 1, collection: 'tournament-invites', where: { status: { equals: 'invited' } }, limit: 2000, pagination: false })
  let reminded = 0
  let expired = 0
  for (const inv of open) {
    const t = inv.tournament as RfaTournament
    const s = inv.squad as TournamentSquad
    if (!t || typeof t !== 'object') continue
    const deadline = new Date(t.rsvpDeadline).getTime()
    if (deadline <= now.getTime()) {
      await p.update({ ...q, collection: 'tournament-invites', where: { id: { equals: inv.id }, status: { equals: 'invited' } }, data: { status: 'expired' } })
      expired++
    } else if (!inv.reminderAt && deadline - now.getTime() <= 48 * 3_600_000) {
      const claimed = await p.update({ ...q, collection: 'tournament-invites', where: { id: { equals: inv.id }, reminderAt: { exists: false } }, data: { reminderAt: nowIso } })
      if (!claimed.docs.length) continue
      await sendInvite(p, { ...inv, tournament: t.id, squad: s.id } as TournamentInvite, t, s, 'reminder')
      reminded++
    }
  }
  return { reminded, expired }
}

/** A family's tournament invites (to answer) and confirmed places, for their account page. */
export async function familyTournaments(p: Payload, accountId: number) {
  const { docs } = await p.find({ ...q, depth: 1, collection: 'tournament-invites', where: { account: { equals: accountId }, status: { in: ['invited', 'accepted', 'paid'] } }, sort: '-invitedAt', limit: 50, pagination: false })
  const today = new Date(Date.now() - 86_400_000).toISOString()
  return docs.filter((i) => typeof i.tournament === 'object' && ((i.tournament as RfaTournament).endDate ?? (i.tournament as RfaTournament).startDate) >= today).map((i) => ({ inv: i, t: i.tournament as RfaTournament, s: i.squad as TournamentSquad, url: `/tournaments/invite/${i.token}`, when: dateRange(i.tournament as RfaTournament) }))
}

/** RFA players Management can invite: Academy-enrolled (RFA tag or a paid term registration), filtered by year of birth. */
export async function rfaPlayers(p: Payload, o: { birthYears?: number[]; q?: string } = {}) {
  const { docs: regs } = await p.find({ ...q, collection: 'academy-registrations', where: { status: { equals: 'paid' } }, limit: 5000, pagination: false, select: { participant: true } })
  const ids = [...new Set(regs.map((r) => rel(r.participant)).filter((x): x is number => Boolean(x)))]
  const where = { or: [{ memberships: { contains: 'rfa' } }, ...(ids.length ? [{ id: { in: ids } }] : [])] }
  const { docs } = await p.find({ ...q, collection: 'participants', where: where as never, sort: 'firstName', limit: 3000, pagination: false })
  const term = (o.q ?? '').trim().toLowerCase()
  return docs.filter((k) => {
    const by = birthYearOf(k.dateOfBirth)
    if (o.birthYears?.length && (!by || !o.birthYears.includes(by))) return false
    if (term && !`${k.firstName} ${k.lastName}`.toLowerCase().includes(term)) return false
    return true
  })
}
