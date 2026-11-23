import type { Payload } from 'payload'
import type { AcademyCoach, Participant, User } from '@/payload-types'
import { coachGroups } from './terms/coach-groups'
import { birthYearOf, groupLabel } from '../lib/age-groups'

const q = { overrideAccess: true, depth: 0, pagination: false } as const
const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : ((v as number | null | undefined) ?? null))

/** Players this coach coaches — their term groups, small groups / 1-on-1s and teams — with where they coach them. */
export async function coachPlayerMap(p: Payload, coach: Pick<AcademyCoach, 'id'>, user: Pick<User, 'id'>) {
  const [groups, bookings, teams] = await Promise.all([
    coachGroups(p, coach.id),
    p.find({ ...q, collection: 'academy-bookings', where: { coach: { equals: coach.id }, status: { in: ['confirmed', 'completed', 'payment_failed'] } }, limit: 2000, select: { participant: true, kind: true } }),
    p.find({ ...q, collection: 'teams', where: { coaches: { in: [user.id] }, archived: { not_equals: true } }, limit: 50, select: { name: true } }),
  ])
  const where = new Map<number, Set<string>>()
  const add = (id: number | null, label: string) => { if (id) where.set(id, (where.get(id) ?? new Set()).add(label)) }
  for (const g of groups) for (const r of g.players) add(rel(r.participant), g.groupName ?? g.program.title)
  for (const b of bookings.docs) add(rel(b.participant), (b as { kind?: string }).kind === 'group' ? 'Small group' : '1-on-1')
  const teamIds = new Map<number, string>()
  if (teams.docs.length) {
    const { docs: members } = await p.find({ ...q, collection: 'team-members', where: { team: { in: teams.docs.map((t) => t.id) }, active: { equals: true } }, limit: 2000, select: { participant: true, team: true } })
    for (const m of members) {
      const name = teams.docs.find((t) => t.id === rel(m.team))?.name ?? 'Team'
      add(rel(m.participant), name)
    }
    for (const t of teams.docs) teamIds.set(t.id, t.name)
  }
  return { where, groups, teamIds }
}

export type Contact = { name: string; relationship: string | null; phone: string; tel: string }
const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

/** Everything on a coach's player profile. Null when the coach doesn't coach this player. */
export async function playerProfile(p: Payload, coach: Pick<AcademyCoach, 'id'>, user: Pick<User, 'id' | 'firstName' | 'email'>, kidId: number, now = new Date()) {
  const { where, groups, teamIds } = await coachPlayerMap(p, coach, user)
  if (!where.has(kidId)) return null
  const kid = (await p.findByID({ collection: 'participants', id: kidId, depth: 1, overrideAccess: true })) as Participant
  const by = birthYearOf(kid.dateOfBirth)
  const accountId = rel(kid.account)
  const nowIso = now.toISOString()

  // Emergency contacts: the family's parents/guardians first, then the emergency contact on the player
  const contacts: Contact[] = []
  const pushContact = (name: string, relationship: string | null, phone?: string | null) => {
    if (!phone?.trim() || contacts.some((c) => c.tel === tel(phone))) return
    contacts.push({ name: name.trim() || 'Parent / guardian', relationship, phone: phone.trim(), tel: tel(phone) })
  }
  if (accountId) {
    const parent = typeof kid.account === 'object' ? (kid.account as User) : ((await p.findByID({ collection: 'users', id: accountId, depth: 0, overrideAccess: true })) as User)
    pushContact([parent.firstName, parent.lastName].filter(Boolean).join(' '), parent.imported?.relationship || 'Parent / guardian', parent.phone)
    const { docs: others } = await p.find({ ...q, collection: 'users', where: { familyAccount: { equals: accountId } }, limit: 5, select: { firstName: true, lastName: true, phone: true } })
    for (const o of others) pushContact([o.firstName, o.lastName].filter(Boolean).join(' '), 'Parent / guardian', o.phone)
  }
  pushContact(kid.medical?.emergencyContact ?? '', kid.medical?.emergencyRelationship || 'Emergency contact', kid.medical?.emergencyPhone)

  // Sessions (1-on-1 / small group) for this player
  const { docs: bookings } = await p.find({ ...q, collection: 'academy-bookings', where: { participant: { equals: kidId } }, limit: 2000, select: { createdAt: true } })
  const bookingIds = bookings.map((b) => b.id)
  const { docs: sessions } = bookingIds.length
    ? await p.find({ ...q, collection: 'academy-sessions', where: { booking: { in: bookingIds }, status: { not_equals: 'cancelled' } }, sort: 'startsAt', limit: 2000, select: { startsAt: true, kind: true, coach: true, coverCoach: true, status: true, group: true } })
    : { docs: [] }
  const mine = (s: (typeof sessions)[number]) => rel(s.coach) === coach.id || rel(s.coverCoach) === coach.id
  const upcoming: { at: string; label: string; href: string | null }[] = sessions
    .filter((s) => mine(s) && s.startsAt >= nowIso && s.status !== 'held')
    .map((s) => ({ at: s.startsAt, label: s.kind === 'one-on-one' ? '1-on-1' : 'Small group', href: s.kind === 'one-on-one' ? `/coach/sessions/${s.id}` : rel(s.group) ? `/coach/sessions/group/${rel(s.group)}` : null }))
  // Term training groups this coach takes the player in
  for (const g of groups) {
    if (!g.players.some((r) => rel(r.participant) === kidId)) continue
    for (const ses of g.sessions.filter((x) => !x.cancelled && x.endsAt > nowIso).slice(0, 4)) upcoming.push({ at: ses.startsAt, label: g.title, href: '/coach/today' })
  }
  upcoming.sort((a, b) => a.at.localeCompare(b.at))

  // Session summaries, newest first (any coach)
  const sessionIds = sessions.map((s) => s.id)
  const { docs: summaries } = sessionIds.length
    ? await p.find({ ...q, collection: 'session-summaries', where: { hidden: { not_equals: true }, submittedAt: { exists: true }, or: [{ session: { in: sessionIds } }, { 'players.session': { in: sessionIds } }] }, sort: '-sessionAt', limit: 500, depth: 1 })
    : { docs: [] }
  const summaryRows = summaries.map((s) => ({
    id: s.id,
    at: s.sessionAt,
    kind: s.kind === 'group' ? 'Small group' : '1-on-1',
    coach: typeof s.coach === 'object' && s.coach ? (s.coach as AcademyCoach).displayName ?? null : null,
    workedOn: (s.workedOn ?? []) as string[],
    wentWell: s.wentWell ?? null,
    nextSteps: s.nextSteps ?? null,
    homework: s.homework ?? null,
    note: (s.players ?? []).find((x) => sessionIds.includes(rel(x.session) ?? -1))?.note ?? null,
  }))

  // Player Development Reports
  const { docs: reports } = await p.find({ ...q, collection: 'player-reports', where: { participant: { equals: kidId } }, sort: '-updatedAt', limit: 50, depth: 1 })
  const reportRows = reports.map((r) => ({ id: r.id, cycle: typeof r.cycle === 'object' && r.cycle ? (r.cycle as { name?: string; title?: string }).name ?? (r.cycle as { title?: string }).title ?? 'Report' : 'Report', status: r.status, releasedAt: r.releasedAt ?? null, mine: rel(r.coach) === user.id }))

  // Match reflections — only for players in a team
  const { docs: memberships } = await p.find({ ...q, collection: 'team-members', where: { participant: { equals: kidId }, active: { equals: true } }, limit: 10, select: { team: true } })
  const inTeam = memberships.length > 0
  const { docs: reflections } = inTeam
    ? await p.find({ ...q, collection: 'match-reflections', where: { participant: { equals: kidId }, status: { equals: 'submitted' } }, sort: '-fixtureAt', limit: 100, depth: 1 })
    : { docs: [] }
  const reflectionRows = reflections.map((r) => ({
    id: r.id,
    at: r.fixtureAt,
    opponent: r.opponent ?? null,
    team: typeof r.team === 'object' && r.team ? (r.team as { name: string }).name : teamIds.get(rel(r.team) ?? -1) ?? '',
    href: `/coach/reflections/${rel(r.team)}/${encodeURIComponent(r.fixtureId)}`,
    feeling: r.feeling ?? null,
    focus: r.focus ?? null,
    moments: (r.moments ?? []).map((m) => ({ type: m.type, pillar: m.pillarName ?? null, comment: m.comment ?? null })),
  }))

  const photo = (kid as { photo?: unknown }).photo
  return {
    kid,
    name: `${kid.firstName} ${kid.lastName}`,
    photoUrl: photo && typeof photo === 'object' ? ((photo as { url?: string }).url ?? null) : null,
    birthYear: by,
    ageGroup: by ? groupLabel(by) : null,
    where: [...(where.get(kidId) ?? [])],
    contacts,
    medical: kid.medical?.conditions?.trim() || null,
    goals: kid.football?.goals?.trim() || null,
    upcoming,
    summaries: summaryRows,
    reports: reportRows,
    inTeam,
    reflections: reflectionRows,
  }
}

/** Record that a coach saw a player's emergency contacts (shown at the top of the profile). */
export async function logContactView(p: Payload, user: Pick<User, 'id' | 'firstName' | 'email'>, kid: Pick<Participant, 'id' | 'firstName' | 'lastName'>) {
  await p.create({
    collection: 'activity-log',
    overrideAccess: true,
    context: { skipActivity: true },
    data: { area: 'Coach portal', what: `${kid.firstName} ${kid.lastName}`, action: 'Viewed emergency contacts', source: 'participants', docId: String(kid.id), by: user.id, byName: user.firstName || user.email },
  }).catch(() => null)
}

export type LastTime = { at: string; coach: string | null; workedOn: string[]; wentWell: string | null; nextSteps: string | null; homework: string | null; note: string | null } | null

/** The most recent session summary before `before` for each player (any coach, any booking). */
export async function lastTimeFor(p: Payload, participantIds: number[], before: string): Promise<Map<number, LastTime>> {
  const out = new Map<number, LastTime>(participantIds.map((id) => [id, null]))
  if (!participantIds.length) return out
  const { docs: bookings } = await p.find({ ...q, collection: 'academy-bookings', where: { participant: { in: participantIds } }, limit: 5000, select: { participant: true } })
  const kidOfBooking = new Map(bookings.map((b) => [b.id, rel(b.participant)!]))
  if (!bookings.length) return out
  const { docs: sessions } = await p.find({ ...q, collection: 'academy-sessions', where: { booking: { in: bookings.map((b) => b.id) }, startsAt: { less_than: before } }, limit: 5000, select: { booking: true } })
  const kidOfSession = new Map(sessions.map((s) => [s.id, kidOfBooking.get(rel(s.booking)!)!]))
  if (!sessions.length) return out
  const ids = [...kidOfSession.keys()]
  const { docs } = await p.find({ ...q, collection: 'session-summaries', where: { submittedAt: { exists: true }, or: [{ session: { in: ids } }, { 'players.session': { in: ids } }] }, sort: '-sessionAt', limit: 1000, depth: 1 })
  for (const s of docs) {
    const kids = new Set<number>()
    const own = kidOfSession.get(rel(s.session) ?? -1)
    if (own) kids.add(own)
    for (const pl of s.players ?? []) { const k = kidOfSession.get(rel(pl.session) ?? -1); if (k) kids.add(k) }
    for (const k of kids) {
      if (out.get(k)) continue // newest first: keep the first one found
      out.set(k, {
        at: s.sessionAt,
        coach: typeof s.coach === 'object' && s.coach ? (s.coach as AcademyCoach).displayName ?? null : null,
        workedOn: (s.workedOn ?? []) as string[],
        wentWell: s.wentWell ?? null,
        nextSteps: s.nextSteps ?? null,
        homework: s.homework ?? null,
        note: (s.players ?? []).find((pl) => kidOfSession.get(rel(pl.session) ?? -1) === k)?.note ?? null,
      })
    }
  }
  return out
}
