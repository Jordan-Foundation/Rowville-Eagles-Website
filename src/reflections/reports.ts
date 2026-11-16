import type { Payload } from 'payload'
import type { MatchReflection, ReflectionReport, Team } from '@/payload-types'
import { sendEmail } from '../lib/email'
import { emailLayout, esc } from '../lib/email-templates'
import { formatDate } from '../lib/format'
import { siteUrl } from '../lib/payments'
import { localToUtc, localYmd, TZ } from '../lib/time'
import { AI_MODEL, REPORT_PROMPT_VERSION, aiConfigured, aiErrorMessage, summariseReport, type ReportInput, type ReportSummary } from './ai'
import { anonLabel, computeStats, recentWeeks, redact, reportReady, type ReflectionStats } from './rules'
import { activeMembers, ageGroupFor, fixtureWindow, heldForWelfare, pillars, reflectionSettings, reflectionTeams, relId, type Fixture } from './service'

/** Fewer submitted reflections than this and no AI summary is written (too few to stay anonymous / meaningful). */
export const MIN_FOR_SUMMARY = 3

export type Scope = { type: 'team' | 'age_group' | 'club'; key: string; label: string; teamIds: number[] }

export type ReportStats = ReflectionStats & { games: number; feelingByValue: Record<string, number> }

const inPeriod = (iso: string, from: Date, to: Date) => { const t = Date.parse(iso); return t >= from.getTime() && t < to.getTime() }

/** Everything for one period: the teams that played, how many reflections each could have had, and what came in. */
async function periodData(payload: Payload, period: { from: string; to: string }) {
  const s = await reflectionSettings(payload)
  const from = localToUtc(period.from, '00:00')
  const to = localToUtc(period.to, '00:00')
  const teams = await reflectionTeams(payload, s)
  const played: { team: Team; fixtures: Fixture[]; members: number }[] = []
  for (const team of teams) {
    // Only games already played (a report built mid-week doesn't count games still to come)
    const fixtures = ((team.fixtures ?? []) as Fixture[]).filter((f) => inPeriod(f.startsAt, from, to) && Date.parse(f.startsAt) <= Date.now())
    if (!fixtures.length) continue
    played.push({ team, fixtures, members: (await activeMembers(payload, team.id)).length })
  }
  const { docs: reflections } = await payload.find({
    collection: 'match-reflections',
    where: { and: [{ fixtureAt: { greater_than_equal: from.toISOString() } }, { fixtureAt: { less_than: to.toISOString() } }] },
    depth: 0, limit: 5000, pagination: false, overrideAccess: true,
  })
  return { played, reflections, from, to }
}

export function scopesFor(played: { team: Team }[]): Scope[] {
  const scopes: Scope[] = played.map(({ team }) => ({ type: 'team', key: String(team.id), label: team.name, teamIds: [team.id] }))
  const ages = new Map<string, number[]>()
  for (const { team } of played) ages.set(ageGroupFor(team), [...(ages.get(ageGroupFor(team)) ?? []), team.id])
  for (const [age, ids] of ages) scopes.push({ type: 'age_group', key: age, label: `Age group ${age}`, teamIds: ids })
  if (played.length) scopes.push({ type: 'club', key: 'club', label: 'Whole club', teamIds: played.map((p) => p.team.id) })
  return scopes
}

export function statsFor(scope: Scope, played: { team: Team; fixtures: Fixture[]; members: number }[], reflections: MatchReflection[], pillarList: { id: number; name: string }[]): ReportStats {
  const teams = played.filter((p) => scope.teamIds.includes(p.team.id))
  const expected = teams.reduce((n, t) => n + t.fixtures.length * t.members, 0)
  const fixtureIds = new Set(teams.flatMap((t) => t.fixtures.map((f) => f.id)))
  const mine = reflections.filter((r) => scope.teamIds.includes(relId(r.team) as number) && fixtureIds.has(r.fixtureId))
  const base = computeStats(mine.map((r) => ({ participant: relId(r.participant) as number, status: r.status, feeling: r.feeling, fixtureAt: r.fixtureAt, moments: (r.moments ?? []).map((m) => ({ type: m.type, pillar: relId(m.pillar), pillarName: m.pillarName })) })), pillarList, expected)
  const feelingByValue: Record<string, number> = {}
  for (const r of mine) if (r.status === 'submitted' && r.feeling) feelingByValue[r.feeling] = (feelingByValue[r.feeling] ?? 0) + 1
  return { ...base, games: teams.reduce((n, t) => n + t.fixtures.length, 0), feelingByValue }
}

const numbersText = (st: ReportStats) => [
  `Games: ${st.games}. Reflections submitted: ${st.submitted} of ${st.expected} possible (${st.completionRate == null ? 'n/a' : Math.round(st.completionRate * 100) + '%'}).`,
  `Average feeling (1–5): ${st.feelingAverage ?? 'not given'} from ${st.feelingCount} players.`,
  ...st.pillars.map((p) => `${p.name}: ${p.great} “did well”, ${p.improve} “to work on”.`),
].join('\n')

/** Anonymised input: no names, IDs, teams or dates beyond the period label. */
async function aiInput(payload: Payload, scope: Scope, period: { from: string; to: string }, st: ReportStats, reflections: MatchReflection[], pillarNames: string[]): Promise<ReportInput> {
  const inScope = reflections.filter((r) => r.status === 'submitted' && scope.teamIds.includes(relId(r.team) as number))
  // Comments under an unreviewed welfare flag are never quoted or summarised (the numbers still count them)
  const held = await heldForWelfare(payload, inScope.map((r) => r.id))
  const submitted = inScope.filter((r) => !held.has(r.id))
  // Every name we know in these teams (players, parents, coaches) is replaced with [name]
  const names = new Set<string>()
  for (const teamId of scope.teamIds) {
    for (const m of await activeMembers(payload, teamId)) { names.add(m.participant.firstName); names.add(m.participant.lastName) }
    const team = await payload.findByID({ collection: 'teams', id: teamId, depth: 1, overrideAccess: true }).catch(() => null)
    for (const c of team?.coaches ?? []) if (typeof c === 'object') { if (c.firstName) names.add(c.firstName); if (c.lastName) names.add(c.lastName) }
  }
  const list = [...names].filter(Boolean)
  // Shuffle so “Player A” can't be matched to alphabetical order or submission time
  const shuffled = [...submitted].sort(() => Math.random() - 0.5)
  return {
    scope: scope.type === 'club' ? 'the whole club' : scope.type === 'age_group' ? 'one age group' : 'one team',
    period: `week of ${period.from}`,
    pillars: pillarNames,
    numbers: numbersText(st),
    reflections: shuffled.map((r, i) => ({
      player: anonLabel(i),
      feeling: r.feeling ?? null,
      great: (r.moments ?? []).filter((m) => m.type === 'great').map((m) => ({ pillar: m.pillarName ?? '', comment: redact(m.comment ?? '', list) })),
      improve: (r.moments ?? []).filter((m) => m.type === 'improve').map((m) => ({ pillar: m.pillarName ?? '', comment: redact(m.comment ?? '', list) })),
      focus: redact(r.focus ?? '', list),
    })),
  }
}

async function saveReport(payload: Payload, scope: Scope, period: { from: string; to: string }, data: Partial<ReflectionReport>) {
  const { docs } = await payload.find({ collection: 'reflection-reports', where: { scopeType: { equals: scope.type }, scopeKey: { equals: scope.key }, periodFrom: { equals: period.from } }, limit: 1, depth: 0, overrideAccess: true })
  const full = { scopeType: scope.type, scopeKey: scope.key, scopeLabel: scope.label, periodFrom: period.from, periodTo: period.to, generatedAt: new Date().toISOString(), ...data } as ReflectionReport
  if (docs[0]) return payload.update({ collection: 'reflection-reports', id: docs[0].id, data: full, depth: 0, overrideAccess: true })
  return payload.create({ collection: 'reflection-reports', data: full, depth: 0, overrideAccess: true })
}

/** Builds (or rebuilds) every report for a period. Numbers always; an AI summary when on, configured and there are enough reflections. */
export async function generateReports(payload: Payload, period: { from: string; to: string }, opts: { only?: { type: Scope['type']; key: string }; keys?: Set<string>; deadline?: number } = {}) {
  const s = await reflectionSettings(payload)
  const { played, reflections } = await periodData(payload, period)
  const pillarList = await pillars(payload, true)
  const pillarNames = pillarList.filter((p) => p.active !== false).map((p) => p.name)
  const scopes = scopesFor(played).filter((sc) => (!opts.only || (sc.type === opts.only.type && sc.key === opts.only.key)) && (!opts.keys || opts.keys.has(`${sc.type}:${sc.key}`)))
  const made: ReflectionReport[] = []
  for (const scope of scopes) {
    if (opts.deadline && Date.now() > opts.deadline) break
    const stats = statsFor(scope, played, reflections, pillarList)
    let status: ReflectionReport['status'] = 'stats_only'
    let summary: ReportSummary | null = null
    let error: string | null = null
    if (stats.submitted < MIN_FOR_SUMMARY) status = 'empty'
    else if (s.aiReports && aiConfigured()) {
      const input = await aiInput(payload, scope, period, stats, reflections.filter((r) => played.some((p) => p.team.id === relId(r.team) && p.fixtures.some((f) => f.id === r.fixtureId))), pillarNames)
      for (let attempt = 0; attempt < 2 && !summary; attempt++) {
        try {
          summary = await summariseReport(input)
          status = 'ok'
          error = null
        } catch (e) {
          error = aiErrorMessage(e)
          status = 'failed'
        }
      }
    } else if (s.aiReports) error = 'ANTHROPIC_API_KEY is not set'
    made.push(await saveReport(payload, scope, period, { stats: stats as unknown as ReflectionReport['stats'], summary: summary as unknown as ReflectionReport['summary'], status, error, model: summary ? AI_MODEL : null, promptVersion: summary ? REPORT_PROMPT_VERSION : null }))
  }
  return made
}

/**
 * Hourly: each report is built and sent once its deadline has passed — the week is over and the last reflection
 * for that scope's games has closed (team by team; age group and club once all their teams' games have closed).
 */
export async function runWeeklyReports(payload: Payload, now = new Date()) {
  const s = await reflectionSettings(payload)
  if (!s.enabled) return { sent: 0 }
  let built = 0
  let notified = 0
  for (const period of recentWeeks(localYmd(now))) {
    const { played, to } = await periodData(payload, period)
    if (!played.length) continue
    const { docs: existing } = await payload.find({ collection: 'reflection-reports', where: { periodFrom: { equals: period.from } }, limit: 500, depth: 0, pagination: false, overrideAccess: true })
    const done = new Set(existing.filter((r) => r.notifiedAt || r.status === 'empty').map((r) => `${r.scopeType}:${r.scopeKey}`))
    const ready = scopesFor(played).filter((sc) => {
      if (done.has(`${sc.type}:${sc.key}`)) return false
      const closes = played.filter((p) => sc.teamIds.includes(p.team.id)).flatMap((p) => p.fixtures.map((f) => fixtureWindow(p.team, f, s).closesAt))
      return reportReady(now, to, closes)
    })
    if (!ready.length) continue
    const made = await generateReports(payload, period, { keys: new Set(ready.map((sc) => `${sc.type}:${sc.key}`)), deadline: Date.now() + 240_000 })
    built += made.length
    notified += await notifyReports(payload, made)
  }
  return { built, notified }
}

/** Emails each team's coaches their report and Management the club report (once each, unless `force` from a manual rebuild). */
export async function notifyReports(payload: Payload, reports: ReflectionReport[], opts: { force?: boolean } = {}) {
  let sent = 0
  const label = (r: ReflectionReport) => `week of ${formatDate(localToUtc(r.periodFrom, '12:00').toISOString(), { day: 'numeric', month: 'short' })}`
  for (const r of reports.filter((x) => x.scopeType === 'team' && x.status !== 'empty' && (opts.force || !x.notifiedAt))) {
    const team = await payload.findByID({ collection: 'teams', id: Number(r.scopeKey), depth: 1, overrideAccess: true }).catch(() => null)
    const summary = r.summary as ReportSummary | null
    for (const c of team?.coaches ?? []) {
      if (typeof c !== 'object' || !c.email) continue
      await sendEmail(payload, {
        to: c.email, sender: 'club', userId: c.id, kind: 'service',
        subject: `${team!.name}: match reflections report (${label(r)})`,
        html: emailLayout('club', [{ heading: `${esc(team!.name)} — reflections report`, intro: esc(summary?.headline ?? 'This week’s reflection numbers are ready.'), cta: { label: 'Read the report', href: `${siteUrl()}/coach/reflections?report=${r.id}` } }]),
      })
      sent++
    }
    await payload.update({ collection: 'reflection-reports', id: r.id, data: { notifiedAt: new Date().toISOString() }, depth: 0, overrideAccess: true })
  }
  const club = reports.find((x) => x.scopeType === 'club')
  if (club && club.status !== 'empty' && (opts.force || !club.notifiedAt)) {
    const { docs: people } = await payload.find({ collection: 'users', where: { roles: { in: ['admin', 'committee'] } }, limit: 50, depth: 0, pagination: false, overrideAccess: true })
    const summary = club.summary as ReportSummary | null
    for (const u of people) {
      if (!u.email) continue
      await sendEmail(payload, {
        to: u.email, sender: 'club', userId: u.id, kind: 'service',
        subject: `Match reflections report (${label(club)})`,
        html: emailLayout('club', [{ heading: 'Weekend reflections report', intro: esc(summary?.headline ?? 'This week’s reflection numbers are ready.'), cta: { label: 'Open reports', href: `${siteUrl()}/management/reflections?tab=reports` } }]),
      })
      sent++
    }
    await payload.update({ collection: 'reflection-reports', id: club.id, data: { notifiedAt: new Date().toISOString() }, depth: 0, overrideAccess: true })
  }
  return sent
}
