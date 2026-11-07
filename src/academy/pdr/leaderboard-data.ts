import type { Payload } from 'payload'
import type { Participant, PdrStage } from '@/payload-types'
import { birthYearOf } from '../../lib/age-groups'
import { bestPerPlayer, displayName, rank, standing, type Entry } from './leaderboard'
import { monthStart } from './rules'

const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number))
export type Period = 'all' | 'month'
export type BoardRow = { player: number; name: string; birthYear: number | null; value: number; rank: number; mine: boolean }

const monthFrom = () => new Date(`${monthStart(new Date())}T00:00:00+10:00`).toISOString()

async function players(p: Payload, ids: number[]) {
  if (!ids.length) return new Map<number, Participant>()
  const { docs } = await p.find({ collection: 'participants', where: { id: { in: ids } }, limit: ids.length, depth: 0, overrideAccess: true, select: { firstName: true, lastName: true, dateOfBirth: true, pdr: true, account: true } })
  return new Map(docs.map((d) => [d.id, d as Participant]))
}

/** Turn entries into public rows: hide opted-out players, filter by age group, rank. */
async function publish(p: Payload, entries: Entry[], direction: 'higher' | 'lower', o: { birthYear?: number | null; mine: Set<number> }) {
  const kids = await players(p, entries.map((e) => e.player))
  const shown = entries.filter((e) => {
    const k = kids.get(e.player)
    if (!k || k.pdr?.leaderboardOptOut) return false
    return !o.birthYear || birthYearOf(k.dateOfBirth) === o.birthYear
  })
  const years = [...new Set(entries.map((e) => birthYearOf(kids.get(e.player)?.dateOfBirth)).filter((y): y is number => Boolean(y)))].sort((a, b) => b - a)
  const rows: BoardRow[] = rank(shown, direction).map((r) => {
    const k = kids.get(r.player)!
    return { player: r.player, name: displayName(k), birthYear: birthYearOf(k.dateOfBirth), value: r.value, rank: r.rank, mine: o.mine.has(r.player) }
  })
  return { rows, years }
}

/** Stage board: best verified score per player (all time, or verified this month). */
export async function stageBoard(p: Payload, stage: Pick<PdrStage, 'id' | 'criteria'>, o: { period: Period; birthYear?: number | null; mine: Set<number> }) {
  const direction = stage.criteria?.direction === 'lower' ? 'lower' : 'higher'
  let entries: Entry[]
  if (o.period === 'month') {
    const { docs } = await p.find({ collection: 'pdr-submissions', where: { stage: { equals: stage.id }, status: { equals: 'verified' }, verifiedScore: { exists: true }, reviewedAt: { greater_than_equal: monthFrom() } }, limit: 5000, depth: 0, overrideAccess: true, select: { player: true, verifiedScore: true, reviewedAt: true } })
    entries = bestPerPlayer(docs.map((d) => ({ player: rel(d.player), value: d.verifiedScore!, at: d.reviewedAt })), direction)
  } else {
    const { docs } = await p.find({ collection: 'pdr-progress', where: { stage: { equals: stage.id }, method: { equals: 'verified' }, score: { exists: true } }, limit: 5000, depth: 0, overrideAccess: true, select: { player: true, score: true, passedAt: true } })
    entries = docs.map((d) => ({ player: rel(d.player), value: d.score!, at: d.passedAt }))
  }
  return publish(p, entries, direction, o)
}

/** Area board: stages passed (all time, or passed this month). */
export async function areaBoard(p: Payload, areaId: number, o: { period: Period; birthYear?: number | null; mine: Set<number> }) {
  const { docs } = await p.find({
    collection: 'pdr-progress',
    where: { area: { equals: areaId }, ...(o.period === 'month' ? { passedAt: { greater_than_equal: monthFrom() } } : {}) },
    limit: 20000,
    depth: 0,
    overrideAccess: true,
    select: { player: true, passedAt: true },
  })
  const count = new Map<number, Entry>()
  for (const d of docs) {
    const id = rel(d.player)
    const c = count.get(id) ?? { player: id, value: 0, at: d.passedAt }
    c.value++
    if ((d.passedAt ?? '') > (c.at ?? '')) c.at = d.passedAt // tie-break: whoever got there first
    count.set(id, c)
  }
  return publish(p, [...count.values()], 'higher', o)
}

/** "Top 15%" for one player's verified best on a stage (everyone who passed counts, opted-out or not). */
export async function stageStanding(p: Payload, stage: Pick<PdrStage, 'id' | 'criteria'>, playerId: number) {
  const s = await p.findGlobal({ slug: 'pdr-settings', depth: 0, overrideAccess: true })
  const { docs } = await p.find({ collection: 'pdr-progress', where: { stage: { equals: stage.id }, method: { equals: 'verified' }, score: { exists: true } }, limit: 5000, depth: 0, overrideAccess: true, select: { player: true, score: true } })
  const mine = docs.find((d) => rel(d.player) === playerId)
  if (!mine) return null
  return standing(mine.score!, docs.map((d) => d.score!), stage.criteria?.direction ?? 'higher', s.minPlayersForRanking ?? 5)
}

/** The visitor's own players (highlighted on boards). */
export async function myPlayers(p: Payload, userId: number | undefined) {
  if (!userId) return new Set<number>()
  const { docs } = await p.find({ collection: 'participants', where: { account: { equals: userId } }, limit: 20, depth: 0, overrideAccess: true, select: { firstName: true } })
  return new Set(docs.map((d) => d.id))
}
