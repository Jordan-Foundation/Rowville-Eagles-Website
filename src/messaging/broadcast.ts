import type { Payload } from 'payload'
import type { AcademyCoach, User } from '@/payload-types'
import { coachGroups } from '../academy/terms/coach-groups'
import { smsConfigured, toE164 } from '../lib/sms'
import { conversationFor, staffReply } from './service'

const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null | undefined) ?? null)
const q = { overrideAccess: true } as const

export type Recipient = { accountId: number; name: string; kids: string[]; via: 'text' | 'email' }
export type Audience = { title: string; recipients: Recipient[] }

/**
 * Families in one of this coach's groups (to = "group:<slot>:<groupId or empty>") or teams (to = "team:<id>").
 * Null when the coach doesn't run it.
 */
export async function broadcastAudience(p: Payload, user: User, coach: AcademyCoach | null, to: string): Promise<Audience | null> {
  const [kind, a, b = ''] = to.split(':')
  const families = new Map<number, string[]>()
  const management = !coach // Management can message any group, team or report round
  let title = ''
  if (kind === 'group') {
    let players: { account?: unknown; player: { firstName: string } }[] = []
    if (coach) {
      const g = (await coachGroups(p, coach.id)).find((x) => x.key === (b ? `${a}:${b}` : a))
      if (!g) return null
      title = g.title
      players = g.players
    } else {
      const slot = await p.findByID({ collection: 'academy-term-slots', id: Number(a), depth: 1, ...q, disableErrors: true })
      if (!slot) return null
      const group = b ? (slot.groups ?? []).find((g) => g.id === b) : null
      const prog = typeof slot.program === 'object' ? slot.program : null
      title = `${group ? `${group.name} · ` : ''}${slot.weekday} ${slot.startTime}${prog ? ` · ${prog.title}` : ''}`
      const { docs } = await p.find({ pagination: false, collection: 'academy-registrations', where: { slot: { equals: slot.id }, status: { equals: 'paid' }, ...(b ? { groupId: { equals: b } } : {}) }, limit: 500, depth: 0, ...q })
      players = docs
    }
    for (const r of players) {
      const acc = rel(r.account)
      if (acc) families.set(acc, [...(families.get(acc) ?? []), r.player.firstName])
    }
  } else if (kind === 'cycle' && management) {
    const cycle = await p.findByID({ collection: 'report-cycles', id: Number(a), depth: 0, ...q, disableErrors: true })
    if (!cycle) return null
    title = `families in ${cycle.name}`
    const { docs } = await p.find({ pagination: false, collection: 'player-reports', where: { cycle: { equals: cycle.id } }, limit: 3000, depth: 0, ...q, select: { account: true, playerName: true } })
    for (const r of docs) {
      const acc = rel(r.account)
      if (acc) families.set(acc, [...(families.get(acc) ?? []), r.playerName.split(' ')[0]])
    }
  } else if (kind === 'team') {
    const team = await p.findByID({ collection: 'teams', id: Number(a), depth: 0, ...q, disableErrors: true })
    if (!team || (!management && !(team.coaches ?? []).map(rel).includes(user.id))) return null
    title = team.name
    const { docs } = await p.find({ pagination: false, collection: 'team-members', where: { team: { equals: team.id }, active: { equals: true } }, limit: 300, depth: 1, ...q })
    for (const m of docs) {
      const acc = rel(m.account)
      const kid = m.participant && typeof m.participant === 'object' ? m.participant.firstName : ''
      if (acc) families.set(acc, [...(families.get(acc) ?? []), kid])
    }
  } else if ((kind === 'everyone' || kind === 'coaches') && management) {
    // Whole-club messages: parents, players with their own accounts, coaches (or some coaches)
    const ids = await everyoneIds(p, kind, a, b)
    if (!ids) return null
    title = ids.title
    for (const id of ids.users) families.set(id, [])
  } else return null
  const ids = [...families.keys()]
  const { docs: users } = ids.length ? await p.find({ pagination: false, collection: 'users', where: { id: { in: ids } }, limit: ids.length, depth: 0, ...q }) : { docs: [] }
  const texting = smsConfigured()
  return {
    title,
    recipients: users
      .map((u) => ({ accountId: u.id, name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email, kids: families.get(u.id) ?? [], via: (texting && toE164(u.phone) && !u.smsOptOut ? 'text' : 'email') as Recipient['via'] }))
      .sort((x, y) => x.name.localeCompare(y.name)),
  }
}

/** Send the same message to every family (each lands in that family's conversation, texted or emailed). */
export async function sendBroadcast(p: Payload, user: User, coach: AcademyCoach | null, to: string, text: string) {
  const audience = await broadcastAudience(p, user, coach, to)
  if (!audience) throw new Error('That group or team isn’t one of yours.')
  if (!text.trim()) throw new Error('Write a message first.')
  let texted = 0, emailed = 0, failed = 0
  for (const r of audience.recipients) {
    try {
      const account = await p.findByID({ collection: 'users', id: r.accountId, depth: 0, ...q })
      const conv = await conversationFor(p, { account })
      const res = await staffReply(p, coach ? { user, side: 'coach', coach } : { user, side: 'management' }, conv.id, text)
      if (res.delivery === 'sms') texted++
      else if (res.delivery === 'email') emailed++
      else failed++
    } catch (e) {
      failed++
      p.logger.error({ err: e, msg: `Broadcast to account ${r.accountId} failed` })
    }
  }
  return { texted, emailed, failed, total: audience.recipients.length }
}


export const EVERYONE_GROUPS = [
  { to: 'everyone:parents', label: 'All parents' },
  { to: 'everyone:players', label: 'All players (with their own account)' },
  { to: 'everyone:families', label: 'All parents and players' },
  { to: 'coaches:all', label: 'All coaches' },
  { to: 'coaches:academy', label: 'Foundation Academy coaches' },
  { to: 'coaches:club', label: 'Rowville Eagles team coaches' },
  { to: 'everyone:all', label: 'Everyone — parents, players and coaches' },
] as const

/** User ids for a whole-club group (to = "everyone:parents" … or "coaches:pick:<id>-<id>"). */
async function everyoneIds(p: Payload, kind: string, a: string, b: string): Promise<{ title: string; users: number[] } | null> {
  const byRole = async (roles: string[]) => (await p.find({ pagination: false, collection: 'users', where: { or: roles.map((r) => ({ roles: { contains: r } })) }, limit: 20000, depth: 0, ...q, select: { email: true } })).docs.map((u) => u.id)
  if (kind === 'everyone') {
    const roles = { parents: ['parent'], players: ['player'], families: ['parent', 'player'], all: ['parent', 'player', 'coach'] }[a]
    const label = EVERYONE_GROUPS.find((g) => g.to === `everyone:${a}`)?.label
    return roles && label ? { title: label.charAt(0).toLowerCase() + label.slice(1), users: await byRole(roles) } : null
  }
  if (a === 'all') return { title: 'all coaches', users: await byRole(['coach']) }
  if (a === 'academy') {
    const { docs } = await p.find({ pagination: false, collection: 'academy-coaches', where: { active: { not_equals: false } }, limit: 500, depth: 0, ...q, select: { user: true } })
    return { title: 'Foundation Academy coaches', users: [...new Set(docs.map((c) => rel(c.user)).filter(Boolean) as number[])] }
  }
  if (a === 'club') {
    const { docs } = await p.find({ pagination: false, collection: 'teams', where: { archived: { not_equals: true } }, limit: 500, depth: 0, ...q, select: { coaches: true } })
    return { title: 'Rowville Eagles team coaches', users: [...new Set(docs.flatMap((t) => (t.coaches ?? []).map(rel)).filter(Boolean) as number[])] }
  }
  if (a === 'pick') {
    const wanted = b.split('-').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200)
    if (!wanted.length) return null
    const { docs } = await p.find({ pagination: false, collection: 'users', where: { id: { in: wanted }, roles: { contains: 'coach' } }, limit: wanted.length, depth: 0, ...q, select: { email: true } })
    return { title: docs.length === 1 ? 'one coach' : `${docs.length} coaches`, users: docs.map((u) => u.id) }
  }
  return null
}

/** Coaches to pick from (name, and whether Academy and/or team coach). */
export async function coachChoices(p: Payload) {
  const [users, academy, teams] = await Promise.all([
    p.find({ pagination: false, collection: 'users', where: { roles: { contains: 'coach' } }, sort: 'firstName', limit: 1000, depth: 0, ...q, select: { firstName: true, lastName: true, email: true } }),
    p.find({ pagination: false, collection: 'academy-coaches', limit: 500, depth: 0, ...q, select: { user: true, active: true } }),
    p.find({ pagination: false, collection: 'teams', where: { archived: { not_equals: true } }, limit: 500, depth: 0, ...q, select: { coaches: true, name: true } }),
  ])
  const ac = new Set(academy.docs.filter((c) => c.active !== false).map((c) => rel(c.user)))
  return users.docs.map((u) => ({
    id: u.id,
    name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
    tags: [ac.has(u.id) && 'Academy', ...teams.docs.filter((t) => (t.coaches ?? []).map(rel).includes(u.id)).map((t) => t.name)].filter(Boolean) as string[],
  }))
}
