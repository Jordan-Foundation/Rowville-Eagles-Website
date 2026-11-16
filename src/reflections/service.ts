import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Payload } from 'payload'
import type { MatchReflection, Participant, ReflectionPillar, Team, User } from '@/payload-types'
import { hasRole } from '../access'
import { sendEmail } from '../lib/email'
import { emailLayout, esc } from '../lib/email-templates'
import { formatDate } from '../lib/format'
import { siteUrl } from '../lib/payments'
import { DEFAULT_PILLARS, nextFixtureAfter, normaliseDraft, reflectionWindow, streak, validateReflection, windowState, type ReflectionInput, type ReflectionWindow, type WindowState } from './rules'

export type Fixture = NonNullable<Team['fixtures']>[number] & { id: string }
export const relId = (v: unknown): number | null => (v && typeof v === 'object' ? ((v as { id?: number }).id ?? null) : typeof v === 'number' ? v : null)

// ── Settings & pillars ──────────────────────────────────────────────────────

export async function reflectionSettings(payload: Payload) {
  const s = await payload.findGlobal({ slug: 'reflection-settings', depth: 0, overrideAccess: true })
  return {
    enabled: s.enabled !== false,
    window: { opensAfterHours: s.opensAfterHours ?? 3, closesAfterDays: s.closesAfterDays ?? 4 },
    remindOnOpen: s.remindOnOpen !== false,
    closingReminderHours: s.closingReminderHours ?? 24,
    teams: (s.teams ?? []).map(relId).filter((x): x is number => Boolean(x)),
    showStreak: s.showStreak !== false,
    aiReports: s.aiReports !== false,
    reportDay: Number(s.reportDay ?? 1),
    reportHour: s.reportHour ?? 9,
    aiWelfareCheck: s.aiWelfareCheck !== false,
    safeguardingEmail: s.safeguardingEmail ?? null,
    keywords: s.keywords ?? '',
  }
}
export type ReflectionSettingsT = Awaited<ReturnType<typeof reflectionSettings>>

export async function pillars(payload: Payload, includeInactive = false): Promise<ReflectionPillar[]> {
  const find = () => payload.find({ collection: 'reflection-pillars', where: includeInactive ? {} : { active: { equals: true } }, sort: 'sortOrder', limit: 50, depth: 0, overrideAccess: true, pagination: false })
  let { docs } = await find()
  if (!docs.length && !(await payload.count({ collection: 'reflection-pillars', overrideAccess: true })).totalDocs) {
    // Local databases without the migration: seed the six PDR areas once
    for (const [i, p] of DEFAULT_PILLARS.entries()) await payload.create({ collection: 'reflection-pillars', data: { ...p, active: true, sortOrder: i + 1 }, depth: 0, overrideAccess: true }).catch(() => null)
    docs = (await find()).docs
  }
  return docs
}

/** Rowville club teams that use reflections (all of them unless Management picked some). */
export async function reflectionTeams(payload: Payload, s?: ReflectionSettingsT): Promise<Team[]> {
  const settings = s ?? (await reflectionSettings(payload))
  if (!settings.enabled) return []
  const { docs } = await payload.find({
    collection: 'teams',
    where: { and: [{ type: { equals: 'rowville' } }, { archived: { not_equals: true } }, ...(settings.teams.length ? [{ id: { in: settings.teams } }] : [])] },
    depth: 0, limit: 200, pagination: false, overrideAccess: true,
  })
  return docs
}

export const teamUsesReflections = (team: Team, s: ReflectionSettingsT) => s.enabled && team.type === 'rowville' && !team.archived && (!s.teams.length || s.teams.includes(team.id))

export function fixtureWindow(team: Team, fixture: Fixture, s: ReflectionSettingsT): ReflectionWindow {
  const next = nextFixtureAfter((team.fixtures ?? []) as Fixture[], fixture)
  return reflectionWindow(fixture.startsAt, next?.startsAt, s.window)
}

export const ageGroupFor = (team: Team) => team.ageGroup?.trim() || 'No age group'

// ── Who can reflect ───────────────────────────────────────────────────────────

export async function activeMembers(payload: Payload, teamId: number) {
  const { docs } = await payload.find({ collection: 'team-members', where: { team: { equals: teamId }, active: { equals: true } }, depth: 1, limit: 500, pagination: false, overrideAccess: true })
  return docs.filter((m) => typeof m.participant === 'object' && m.participant).map((m) => ({ participant: m.participant as Participant, account: relId(m.account) as number }))
}

export type GameContext = { team: Team; fixture: Fixture; participant: Participant; window: ReflectionWindow; state: WindowState; settings: ReflectionSettingsT }

/** Loads a game for one player, checking the player is on the team and the team uses reflections. */
export async function gameContext(payload: Payload, participantId: number, teamId: number, fixtureId: string): Promise<GameContext | null> {
  const settings = await reflectionSettings(payload)
  const [team, participant] = await Promise.all([
    payload.findByID({ collection: 'teams', id: teamId, depth: 0, overrideAccess: true }).catch(() => null),
    payload.findByID({ collection: 'participants', id: participantId, depth: 0, overrideAccess: true }).catch(() => null),
  ])
  if (!team || !participant || !teamUsesReflections(team, settings)) return null
  const fixture = (team.fixtures ?? []).find((f) => f.id === fixtureId) as Fixture | undefined
  if (!fixture) return null
  const { totalDocs } = await payload.count({ collection: 'team-members', where: { team: { equals: teamId }, participant: { equals: participantId }, active: { equals: true } }, overrideAccess: true })
  if (!totalDocs) return null
  const window = fixtureWindow(team, fixture, settings)
  return { team, fixture, participant, window, state: windowState(window), settings }
}

/** The family's own player (or an adult player themselves). */
export const ownsPlayer = (user: User | null, p: Participant) => Boolean(user && relId(p.account) === user.id)

// ── Kid link (no login: only that player's reflection for that game, until it closes) ──

const sign = (s: string) => createHmac('sha256', process.env.PAYLOAD_SECRET || 'dev-secret').update(`reflect:${s}`).digest('base64url').slice(0, 22)

export function reflectToken(participantId: number, teamId: number, fixtureId: string, expires: Date) {
  const body = `${participantId}.${teamId}.${fixtureId}.${Math.floor(expires.getTime() / 1000).toString(36)}`
  return `${body}.${sign(body)}`
}

export function readReflectToken(token: string, now = new Date()): { participantId: number; teamId: number; fixtureId: string } | null {
  const parts = token.split('.')
  if (parts.length !== 5) return null
  const [p, t, f, exp, sig] = parts
  const want = sign(`${p}.${t}.${f}.${exp}`)
  const a = Buffer.from(sig)
  const b = Buffer.from(want)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  if (parseInt(exp, 36) * 1000 < now.getTime()) return null
  const participantId = Number(p)
  const teamId = Number(t)
  if (!Number.isInteger(participantId) || !Number.isInteger(teamId) || !f) return null
  return { participantId, teamId, fixtureId: f }
}

export const kidLink = (g: GameContext) => `${siteUrl()}/reflect/l/${reflectToken(g.participant.id, g.team.id, g.fixture.id, g.window.closesAt)}`
export const familyLink = (participantId: number, teamId: number, fixtureId: string) => `/reflect/${participantId}/${teamId}/${fixtureId}`

// ── Reading & saving ─────────────────────────────────────────────────────────

export async function findReflection(payload: Payload, participantId: number, fixtureId: string, depth = 0): Promise<MatchReflection | null> {
  const { docs } = await payload.find({ collection: 'match-reflections', where: { participant: { equals: participantId }, fixtureId: { equals: fixtureId } }, limit: 1, depth, overrideAccess: true })
  return docs[0] ?? null
}

export type SaveResult = { ok: boolean; status: 'draft' | 'submitted' | null; errors: string[]; savedAt?: string }

export async function saveReflection(payload: Payload, g: GameContext, input: ReflectionInput, opts: { submit: boolean; source: 'family' | 'link' }): Promise<SaveResult> {
  if (g.state !== 'open') return { ok: false, status: null, errors: [g.state === 'upcoming' ? 'Reflections open 3 hours after kick-off.' : 'This reflection has closed.'] }
  const list = await pillars(payload, true)
  const activeIds = list.filter((p) => p.active !== false).map((p) => p.id)
  const existing = await findReflection(payload, g.participant.id, g.fixture.id)
  // Pillars already chosen stay valid even if Management has since switched one off
  const allowed = [...new Set([...activeIds, ...(existing?.moments ?? []).map((m) => relId(m.pillar)).filter((x): x is number => Boolean(x))])]
  const draft = normaliseDraft(input, allowed)
  if (opts.submit) {
    const v = validateReflection(draft, allowed)
    if (!v.ok) return { ok: false, status: existing?.status ?? null, errors: v.errors }
  }
  const name = new Map(list.map((p) => [p.id, p.name]))
  const data = {
    feeling: draft.feeling,
    focus: draft.focus.replace(/\s+/g, ' ').trim(),
    moments: draft.moments.map((m) => ({ type: m.type, position: m.position, pillar: m.pillar, pillarName: m.pillar ? (name.get(m.pillar) ?? null) : null, comment: opts.submit ? m.comment.replace(/\s+/g, ' ').trim() : m.comment })),
    ...(opts.submit ? { status: 'submitted' as const, submittedAt: new Date().toISOString(), source: opts.source } : {}),
  }
  let doc: MatchReflection
  if (existing) {
    // Once submitted it stays submitted — later edits must pass the same checks
    if (existing.status === 'submitted' && !opts.submit) return { ok: false, status: 'submitted', errors: ['Press “Save changes” to update a submitted reflection.'] }
    doc = await payload.update({ collection: 'match-reflections', id: existing.id, data, depth: 0, overrideAccess: true })
  } else {
    doc = await payload.create({
      collection: 'match-reflections',
      data: {
        ...data,
        participant: g.participant.id,
        account: relId(g.participant.account) as number,
        team: g.team.id,
        fixtureId: g.fixture.id,
        fixtureAt: g.fixture.startsAt,
        opponent: g.fixture.opponent,
        ageGroup: ageGroupFor(g.team),
        status: opts.submit ? 'submitted' : 'draft',
        source: opts.source,
      },
      depth: 0,
      overrideAccess: true,
    })
  }
  return { ok: true, status: doc.status, errors: [], savedAt: doc.updatedAt }
}

// ── Games for a player (history, due, focus) ─────────────────────────────────

export type PlayerGame = { team: Team; fixture: Fixture; window: ReflectionWindow; state: WindowState; reflection: MatchReflection | null }

export async function playerGames(payload: Payload, participantId: number, opts: { since?: Date } = {}): Promise<PlayerGame[]> {
  const settings = await reflectionSettings(payload)
  if (!settings.enabled) return []
  const { docs: members } = await payload.find({ collection: 'team-members', where: { participant: { equals: participantId }, active: { equals: true } }, depth: 1, limit: 20, pagination: false, overrideAccess: true })
  const teams = members.map((m) => m.team).filter((t): t is Team => Boolean(t && typeof t === 'object' && teamUsesReflections(t, settings)))
  const { docs: refl } = await payload.find({ collection: 'match-reflections', where: { participant: { equals: participantId } }, depth: 0, limit: 500, pagination: false, overrideAccess: true })
  const byFixture = new Map(refl.map((r) => [r.fixtureId, r]))
  const since = opts.since?.getTime() ?? 0
  const out: PlayerGame[] = []
  for (const team of teams) for (const f of (team.fixtures ?? []) as Fixture[]) {
    if (Date.parse(f.startsAt) < since) continue
    const window = fixtureWindow(team, f, settings)
    out.push({ team, fixture: f, window, state: windowState(window), reflection: byFixture.get(f.id) ?? null })
  }
  // Reflections for games no longer on a team page (e.g. fixture removed / player moved) still show in history
  for (const r of refl) if (!out.some((g) => g.fixture.id === r.fixtureId)) {
    const team = await payload.findByID({ collection: 'teams', id: relId(r.team) as number, depth: 0, overrideAccess: true }).catch(() => null)
    if (team) out.push({ team, fixture: { id: r.fixtureId, startsAt: r.fixtureAt, opponent: r.opponent ?? '' } as Fixture, window: { opensAt: new Date(r.fixtureAt), closesAt: new Date(r.fixtureAt) }, state: 'closed', reflection: r })
  }
  return out.sort((a, b) => b.fixture.startsAt.localeCompare(a.fixture.startsAt))
}

/** Reflected games in a row (most recent first), ignoring a game still open. */
export function playerStreak(games: PlayerGame[]) {
  return streak(games.filter((g) => g.state !== 'upcoming').map((g) => ({ at: g.fixture.startsAt, reflected: g.reflection?.status === 'submitted', open: g.state === 'open' })))
}

/** The player's focus from their last submitted reflection, shown before their next game. */
export function focusForNextGame(games: PlayerGame[], now = Date.now()) {
  const next = [...games].filter((g) => Date.parse(g.fixture.startsAt) > now).sort((a, b) => a.fixture.startsAt.localeCompare(b.fixture.startsAt))[0]
  const last = games.filter((g) => g.reflection?.status === 'submitted' && Date.parse(g.fixture.startsAt) <= now).sort((a, b) => b.fixture.startsAt.localeCompare(a.fixture.startsAt))[0]
  if (!next || !last?.reflection?.focus) return null
  return { focus: last.reflection.focus, next, from: last }
}

/** Open reflections for every player in a family (for the account page). */
export async function familyDue(payload: Payload, user: User) {
  const { docs: kids } = await payload.find({ collection: 'participants', where: { account: { equals: user.id } }, depth: 0, limit: 20, pagination: false, overrideAccess: true })
  const since = new Date(Date.now() - 30 * 86_400_000)
  const out: { participant: Participant; game: PlayerGame; focus: ReturnType<typeof focusForNextGame> }[] = []
  const focuses: { participant: Participant; focus: NonNullable<ReturnType<typeof focusForNextGame>> }[] = []
  for (const k of kids) {
    const games = await playerGames(payload, k.id, { since })
    for (const g of games) if (g.state === 'open' && g.reflection?.status !== 'submitted') out.push({ participant: k, game: g, focus: null })
    const f = focusForNextGame(games)
    if (f) focuses.push({ participant: k, focus: f })
  }
  return { due: out, focuses }
}

// ── Coach / staff access ───────────────────────────────────────────────────────

export const isManagement = (user: User | null) => hasRole(user, 'admin', 'committee')
export const coachesTeam = (user: User | null, team: Team) => Boolean(user && (team.coaches ?? []).some((c) => relId(c) === user.id))
export const canSeeTeam = (user: User | null, team: Team) => isManagement(user) || coachesTeam(user, team)

export async function addFeedback(payload: Payload, reflectionId: number, coach: User, comment: string) {
  const r = await payload.findByID({ collection: 'match-reflections', id: reflectionId, depth: 0, overrideAccess: true })
  const team = await payload.findByID({ collection: 'teams', id: relId(r.team) as number, depth: 0, overrideAccess: true })
  if (!canSeeTeam(coach, team)) throw new Error('Not your team')
  if (r.status !== 'submitted') throw new Error('This reflection hasn’t been submitted yet')
  const text = comment.replace(/\s+/g, ' ').trim().slice(0, 500)
  const feedback = [...(r.feedback ?? []).filter((f) => !(relId(f.coach) === coach.id && !f.comment && !text)), { coach: coach.id, seenAt: new Date().toISOString(), comment: text || null }]
  await payload.update({ collection: 'match-reflections', id: r.id, data: { feedback: feedback.map((f) => ({ coach: relId(f.coach), seenAt: f.seenAt, comment: f.comment })) }, depth: 0, overrideAccess: true })
  if (text) {
    const family = await payload.findByID({ collection: 'users', id: relId(r.account) as number, depth: 0, overrideAccess: true }).catch(() => null)
    const player = await payload.findByID({ collection: 'participants', id: relId(r.participant) as number, depth: 0, overrideAccess: true }).catch(() => null)
    if (family?.email && player) {
      await sendEmail(payload, {
        to: family.email,
        subject: `${coach.firstName ?? 'Your coach'} replied to ${player.firstName}’s reflection`,
        sender: team.brand === 'academy' ? 'academy' : 'club',
        userId: family.id,
        kind: 'service',
        html: emailLayout(team.brand === 'academy' ? 'academy' : 'club', [{
          heading: `A note from ${esc(coach.firstName ?? 'the coach')}`,
          intro: `${esc(coach.firstName ?? 'The coach')} read ${esc(player.firstName)}’s reflection on the game against ${esc(r.opponent ?? '')} and left a comment.`,
          rows: [['Comment', esc(text)]],
          cta: { label: 'See reflections', href: `${siteUrl()}/account/players/${player.id}/reflections` },
        }]),
      })
    }
  }
}

// ── Reminder emails (hourly) ───────────────────────────────────────────────────

async function remindOnce(payload: Payload, participant: number, fixtureId: string, kind: 'open' | 'closing') {
  try {
    await payload.create({ collection: 'reflection-reminders', data: { participant, fixtureId, kind }, depth: 0, overrideAccess: true })
    return true
  } catch {
    return false // already sent
  }
}

export async function sendReflectionReminders(payload: Payload, now = new Date()) {
  const s = await reflectionSettings(payload)
  const counts = { opened: 0, closing: 0 }
  if (!s.enabled) return counts
  const teams = await reflectionTeams(payload, s)
  for (const team of teams) {
    for (const f of (team.fixtures ?? []) as Fixture[]) {
      const w = fixtureWindow(team, f, s)
      if (windowState(w, now) !== 'open') continue
      // Only games whose window opened recently get the "it's open" email (nothing for old games when this is switched on)
      const justOpened = s.remindOnOpen && now.getTime() - w.opensAt.getTime() < 12 * 3_600_000
      const closingSoon = s.closingReminderHours > 0 && w.closesAt.getTime() - now.getTime() <= s.closingReminderHours * 3_600_000
      if (!justOpened && !closingSoon) continue
      const members = await activeMembers(payload, team.id)
      if (!members.length) continue
      const { docs: done } = await payload.find({ collection: 'match-reflections', where: { team: { equals: team.id }, fixtureId: { equals: f.id }, status: { equals: 'submitted' } }, depth: 0, limit: 500, pagination: false, overrideAccess: true, select: { participant: true } })
      const submitted = new Set(done.map((d) => relId(d.participant)))
      for (const m of members) {
        if (submitted.has(m.participant.id)) continue
        let kind: 'open' | 'closing' | null = null
        if (closingSoon) {
          // Closing reminder only for families who had the opening email (or when opening emails are off)
          const { totalDocs: hadOpen } = await payload.count({ collection: 'reflection-reminders', where: { participant: { equals: m.participant.id }, fixtureId: { equals: f.id }, kind: { equals: 'open' } }, overrideAccess: true })
          if (hadOpen || !s.remindOnOpen) kind = 'closing'
        }
        if (!kind && justOpened) kind = 'open'
        if (!kind || !(await remindOnce(payload, m.participant.id, f.id, kind))) continue
        const family = await payload.findByID({ collection: 'users', id: m.account, depth: 0, overrideAccess: true }).catch(() => null)
        if (!family?.email) continue
        const g: GameContext = { team, fixture: f, participant: m.participant, window: w, state: 'open', settings: s }
        const kid = m.participant.firstName
        await sendEmail(payload, {
          to: family.email,
          subject: kind === 'open' ? `${kid}: how did the game go? (2-minute reflection)` : `Last chance: ${kid}’s reflection closes ${formatDate(w.closesAt.toISOString(), { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`,
          sender: team.brand === 'academy' ? 'academy' : 'club',
          userId: family.id,
          kind: 'service',
          html: emailLayout(team.brand === 'academy' ? 'academy' : 'club', [{
            heading: kind === 'open' ? `${esc(kid)}’s match reflection is open` : `${esc(kid)}’s reflection closes soon`,
            intro: `${esc(team.name)} vs ${esc(f.opponent)} — ${esc(kid)} picks 3 things that went well, 3 to work on, and a focus for next game. It takes about 2 minutes, win or lose.`,
            rows: [['Closes', formatDate(w.closesAt.toISOString(), { weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })]],
            cta: { label: 'Start the reflection', href: `${siteUrl()}${familyLink(m.participant.id, team.id, f.id)}` },
            after: `Want ${esc(kid)} to do it on their own device? This private link opens only their reflection for this game, no login needed: <a href="${kidLink(g)}">${esc(kid)}’s link</a>`,
          }]),
        })
        counts[kind === 'open' ? 'opened' : 'closing']++
      }
    }
  }
  return counts
}
