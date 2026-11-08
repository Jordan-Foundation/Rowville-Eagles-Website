import type { Payload } from 'payload'
import type { Program, SelectionEntry, SelectionRound, Squad, Team, User } from '@/payload-types'
import { hasRole } from '../access'
import { sendEmail } from '../lib/email'
import { emailLayout, esc } from '../lib/email-templates'
import { formatDate } from '../lib/format'
import { siteUrl } from '../lib/payments'
import { sendSms } from '../lib/sms'

const rel = (v: number | { id: number } | null | undefined) => (v && typeof v === 'object' ? v.id : (v ?? null))
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)

/** Team title as families see it: "[Tournament] – [Team]" or "[Team]". */
export const teamTitle = (t: Pick<Team, 'type' | 'event' | 'name'>) => (t.type === 'tournament' && t.event ? `${t.event} – ${t.name}` : t.name)

// ── Teams & members ──────────────────────────────────────────────────────────

/** Tournament squads get their own team page, created the first time a player in the squad pays. */
export async function ensureSquadTeam(payload: Payload, squad: Squad): Promise<number | null> {
  if (squad.team) return rel(squad.team)
  const round = (typeof squad.round === 'object' ? squad.round : await payload.findByID({ collection: 'selection-rounds', id: squad.round, depth: 1, overrideAccess: true })) as SelectionRound
  if (round.kind !== 'tournament') return null
  const program = (round.program && typeof round.program === 'object' ? round.program : round.program ? await payload.findByID({ collection: 'programs', id: rel(round.program)!, depth: 0, overrideAccess: true }) : null) as Program | null
  const base = slugify(`${program?.slug ?? round.title}-${squad.name}`)
  let slug = base
  for (let i = 2; (await payload.count({ collection: 'teams', where: { slug: { equals: slug } }, overrideAccess: true })).totalDocs > 0; i++) slug = `${base}-${i}`
  const team = await payload.create({
    collection: 'teams',
    overrideAccess: true,
    data: {
      type: 'tournament',
      name: squad.name,
      slug,
      event: program?.title ?? round.title,
      season: round.season,
      brand: program?.brand === 'academy' ? 'academy' : 'club',
      ageGroup: (squad.birthYears ?? []).map((y) => `${y}s`).join(' / ') || undefined,
      coaches: (squad.coaches ?? []).map((c) => rel(c)!).filter(Boolean),
      sections: { info: true, notices: true, fixtures: true, training: false, forum: false },
      info: {
        dates: program?.startDate ? formatDate(program.startDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : undefined,
        venues: program?.location ?? undefined,
      },
    },
  })
  await payload.update({ collection: 'squads', id: squad.id, data: { team: team.id }, overrideAccess: true })
  return team.id
}

export async function addMember(payload: Payload, m: { team: number; participant: number; account: number; source: 'selection' | 'registration' | 'admin'; selectionEntry?: number }) {
  const { docs } = await payload.find({ pagination: false, collection: 'team-members', where: { team: { equals: m.team }, participant: { equals: m.participant } }, limit: 1, depth: 0, overrideAccess: true })
  if (docs[0]) {
    if (!docs[0].active) await payload.update({ collection: 'team-members', id: docs[0].id, data: { active: true }, overrideAccess: true })
    return docs[0]
  }
  return payload.create({ collection: 'team-members', overrideAccess: true, data: { ...m, active: true } })
}

/** A paid selection → the player joins the squad's team. */
export async function joinFromEntry(payload: Payload, e: SelectionEntry) {
  const participant = rel(e.participant)
  const account = rel(e.account)
  if (!e.squad || !participant || !account) return null
  const squad = (typeof e.squad === 'object' ? e.squad : await payload.findByID({ collection: 'squads', id: e.squad, depth: 1, overrideAccess: true })) as Squad
  const team = await ensureSquadTeam(payload, squad)
  if (!team) return null
  return addMember(payload, { team, participant, account, source: 'selection', selectionEntry: e.id })
}

/**
 * Daily catch-up (and first run after deploy): every paid selection and every paid Rowville registration
 * has its team membership. Idempotent.
 */
export async function syncTeamMembers(payload: Payload) {
  const result = { selections: 0, registrations: 0 }
  const { docs: paid } = await payload.find({ pagination: false, collection: 'selection-entries', where: { status: { equals: 'registered' }, squad: { exists: true } }, limit: 5000, depth: 1, overrideAccess: true })
  for (const e of paid) if (await joinFromEntry(payload, e)) result.selections++
  const { docs: kids } = await payload.find({ pagination: false, collection: 'participants', where: { team: { exists: true }, 'registrationOffer.status': { equals: 'paid' } }, limit: 5000, depth: 0, overrideAccess: true })
  for (const k of kids) {
    await addMember(payload, { team: rel(k.team)!, participant: k.id, account: rel(k.account)!, source: 'registration' })
    result.registrations++
  }
  return result
}

// ── Access ───────────────────────────────────────────────────────────────────

export type TeamAccess = { view: boolean; manage: boolean; member: boolean }

/** Paid members (their parents) see the page; the team's coaches and admins manage it. Archived pages are staff-only. */
export async function teamAccess(payload: Payload, user: User | null, team: Team): Promise<TeamAccess> {
  if (!user) return { view: false, manage: false, member: false }
  const staff = hasRole(user, 'admin', 'committee')
  const coach = (team.coaches ?? []).some((c) => rel(c) === user.id)
  const { totalDocs } = await payload.count({ collection: 'team-members', where: { team: { equals: team.id }, account: { equals: user.id }, active: { equals: true } }, overrideAccess: true })
  const member = totalDocs > 0
  const manage = staff || coach
  return { view: manage || (member && !team.archived), manage, member }
}

/** Teams on a family's (and coach's) profile. */
export async function myTeams(payload: Payload, user: User, participantId?: number) {
  const { docs: members } = await payload.find({
    collection: 'team-members',
    where: { account: { equals: user.id }, active: { equals: true }, ...(participantId ? { participant: { equals: participantId } } : {}) },
    depth: 1,
    limit: 100,
    overrideAccess: true,
  })
  const teams = new Map<number, { team: Team; players: string[]; coach: boolean }>()
  for (const m of members) {
    const t = m.team as Team
    if (t.archived) continue
    const kid = typeof m.participant === 'object' ? m.participant.firstName : ''
    const cur = teams.get(t.id) ?? { team: t, players: [], coach: false }
    cur.players.push(kid)
    teams.set(t.id, cur)
  }
  if (!participantId) {
    const { docs: coached } = await payload.find({ pagination: false, collection: 'teams', where: { coaches: { in: [user.id] }, archived: { not_equals: true } }, depth: 0, limit: 50, overrideAccess: true })
    for (const t of coached) teams.set(t.id, { ...(teams.get(t.id) ?? { team: t, players: [] }), coach: true })
  }
  return [...teams.values()]
}

// ── Notice board ─────────────────────────────────────────────────────────────

/** Parents of active members, once each. */
export async function teamRecipients(payload: Payload, teamId: number) {
  const { docs } = await payload.find({ pagination: false, collection: 'team-members', where: { team: { equals: teamId }, active: { equals: true } }, depth: 1, limit: 1000, overrideAccess: true })
  const users = new Map<number, User>()
  for (const m of docs) if (typeof m.account === 'object' && m.account) users.set(m.account.id, m.account as User)
  return [...users.values()]
}

/** Email the full post and text a short summary + link to every member. Service messages: sender identified, logged. */
export async function blastNotice(payload: Payload, team: Team, post: { id: number; title: string; body: string }, author: User) {
  const recipients = await teamRecipients(payload, team.id)
  const brand = team.brand === 'academy' ? 'academy' : 'club'
  const url = `${siteUrl()}/teams/${team.slug}#notices`
  const title = teamTitle(team)
  const who = [author.firstName, author.lastName].filter(Boolean).join(' ') || 'Your coach'
  const html = emailLayout(brand, [
    {
      heading: post.title,
      intro: `${esc(post.body).replace(/\n/g, '<br>')}<br><br><span style="color:#888">— ${esc(who)}, ${esc(title)}</span>`,
      cta: { label: 'Open the team page', href: url },
    },
  ], { footerNote: `You’re receiving this because your player is registered with ${title}.` })
  const summary = post.title.length > 70 ? `${post.title.slice(0, 67)}…` : post.title
  for (const u of recipients) {
    await sendEmail(payload, { to: u.email, subject: `${title}: ${post.title}`, html, sender: brand, userId: u.id })
    await sendSms(payload, { to: u.phone, kind: 'service', optedOut: u.smsOptOut, body: `${title} notice: ${summary} — ${url} – ${brand === 'academy' ? 'Foundation Academy' : 'Rowville Eagles'}` })
  }
  await payload.update({ collection: 'team-posts', id: post.id, data: { sentAt: new Date().toISOString(), sentTo: recipients.length }, overrideAccess: true })
  return recipients.length
}
