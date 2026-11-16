import type { Payload } from 'payload'
import type { MatchReflection, Team } from '@/payload-types'
import { localToUtc, localYmd } from '../lib/time'
import { computeStats, weekKey, type ReflectionStats } from './rules'
import { activeMembers, ageGroupFor, pillars, reflectionSettings, reflectionTeams, relId, type Fixture } from './service'

export type DashFilters = { from: string; to: string; ageGroup?: string; team?: number; player?: number }

export function defaultRange(now = new Date()) {
  const to = new Date(now.getTime() + 86_400_000)
  const from = new Date(now.getTime() - 8 * 7 * 86_400_000)
  return { from: localYmd(from), to: localYmd(to) }
}

export type Dashboard = {
  teams: Team[]
  ageGroups: string[]
  stats: ReflectionStats
  weeks: string[]
  weekly: { week: string; expected: number; submitted: number; feeling: number | null }[]
  trends: { name: string; great: number[]; improve: number[] }[]
  reflections: MatchReflection[]
}

/** Everything the Management overview needs for a set of filters. Numbers are counted here, never by the AI. */
export async function loadDashboard(payload: Payload, f: DashFilters): Promise<Dashboard> {
  const s = await reflectionSettings(payload)
  const from = localToUtc(f.from, '00:00')
  const to = localToUtc(f.to, '00:00')
  const allTeams = await reflectionTeams(payload, s)
  const ageGroups = [...new Set(allTeams.map((t) => ageGroupFor(t)))].sort()
  let teams = allTeams.filter((t) => (!f.team || t.id === f.team) && (!f.ageGroup || ageGroupFor(t) === f.ageGroup))
  let playerTeams: number[] | null = null
  if (f.player) {
    const { docs } = await payload.find({ collection: 'team-members', where: { participant: { equals: f.player }, active: { equals: true } }, depth: 0, limit: 20, pagination: false, overrideAccess: true })
    playerTeams = docs.map((m) => relId(m.team) as number)
    teams = teams.filter((t) => playerTeams!.includes(t.id))
  }
  // Expected reflections: each game in range × players on the team (or 1 per game for a single player)
  const expectedByWeek = new Map<string, number>()
  const fixtureIds = new Set<string>()
  for (const t of teams) {
    const games = ((t.fixtures ?? []) as Fixture[]).filter((x) => { const at = Date.parse(x.startsAt); return at >= from.getTime() && at < to.getTime() && at <= Date.now() })
    if (!games.length) continue
    const n = f.player ? 1 : (await activeMembers(payload, t.id)).length
    for (const g of games) {
      fixtureIds.add(g.id)
      const wk = weekKey(localYmd(new Date(g.startsAt)))
      expectedByWeek.set(wk, (expectedByWeek.get(wk) ?? 0) + n)
    }
  }
  const { docs: all } = await payload.find({
    collection: 'match-reflections',
    where: { and: [{ fixtureAt: { greater_than_equal: from.toISOString() } }, { fixtureAt: { less_than: to.toISOString() } }, ...(teams.length ? [{ team: { in: teams.map((t) => t.id) } }] : [{ id: { equals: -1 } }]), ...(f.player ? [{ participant: { equals: f.player } }] : [])] },
    depth: 1, limit: 5000, pagination: false, sort: '-fixtureAt', overrideAccess: true,
  })
  const reflections = all.filter((r) => fixtureIds.has(r.fixtureId) || r.status === 'submitted')
  const list = (await pillars(payload, true)).map((p) => ({ id: p.id, name: p.name, active: p.active !== false }))
  const toStat = (r: MatchReflection) => ({ participant: relId(r.participant) as number, status: r.status, feeling: r.feeling, fixtureAt: r.fixtureAt, moments: (r.moments ?? []).map((m) => ({ type: m.type, pillar: relId(m.pillar), pillarName: m.pillarName })) })
  const expected = [...expectedByWeek.values()].reduce((a, b) => a + b, 0)
  const stats = computeStats(reflections.map(toStat), list, expected)
  const weeks = [...new Set([...expectedByWeek.keys(), ...reflections.map((r) => weekKey(localYmd(new Date(r.fixtureAt))))])].sort()
  const weekly = weeks.map((week) => {
    const st = computeStats(reflections.filter((r) => weekKey(localYmd(new Date(r.fixtureAt))) === week).map(toStat), list, expectedByWeek.get(week) ?? 0)
    return { week, expected: st.expected, submitted: st.submitted, feeling: st.feelingAverage, pillars: st.pillars }
  })
  const trends = list.filter((p) => p.active || stats.pillars.some((x) => x.pillar === p.id && x.great + x.improve > 0)).map((p) => ({
    name: p.name,
    great: weekly.map((w) => w.pillars.find((x) => x.pillar === p.id)?.great ?? 0),
    improve: weekly.map((w) => w.pillars.find((x) => x.pillar === p.id)?.improve ?? 0),
  }))
  return { teams: allTeams, ageGroups, stats, weeks, weekly: weekly.map(({ pillars: _p, ...w }) => w), trends, reflections }
}
