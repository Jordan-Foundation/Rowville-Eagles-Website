import { bestPerPlayer, rank, type Entry } from './leaderboard'
import type { Tier } from './report'

/**
 * Foundation+ monthly challenges (pure — unit tested).
 *  - A challenge runs for one calendar month (Melbourne time), e.g. "2026-12".
 *  - Premium players (including the free month) can send as many attempts as they like; a coach checks
 *    each one and the best checked score counts. One attempt waiting for a coach at a time.
 *  - Results are per year of birth (or one board for everyone). Ties share a place, so tied winners all win.
 */
export type ChallengeState = 'upcoming' | 'open' | 'closed'
export type Direction = 'higher' | 'lower'

/** "2026-12" for a moment in Melbourne. */
export function monthKey(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit' }).format(d)
}

export const validMonth = (m: string) => /^20\d\d-(0[1-9]|1[0-2])$/.test(m)

export function challengeState(month: string, now = new Date()): ChallengeState {
  const current = monthKey(now)
  return month > current ? 'upcoming' : month === current ? 'open' : 'closed'
}

export function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** Days left in the month, counting today (Melbourne). */
export function daysLeft(month: string, now = new Date()) {
  if (challengeState(month, now) !== 'open') return 0
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const today = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', day: '2-digit' }).format(now))
  return last - today + 1
}

export function canEnterChallenge(o: { state: ChallengeState; tier: Tier; pending: number; published: boolean }): { ok: true } | { ok: false; reason: string } {
  if (!o.published) return { ok: false, reason: 'This challenge isn’t live yet.' }
  if (o.state === 'upcoming') return { ok: false, reason: 'This challenge hasn’t started yet.' }
  if (o.state === 'closed') return { ok: false, reason: 'This challenge has finished.' }
  if (o.tier !== 'premium') return { ok: false, reason: 'Monthly challenges are part of Premium.' }
  if (o.pending > 0) return { ok: false, reason: 'There’s already an attempt waiting for a coach — you can send another once it’s checked.' }
  return { ok: true }
}

export type ResultRow = { player: number; group: string; value: number; rank: number; winner: boolean; at?: string | null }

/**
 * Final standings: each player's best checked score, ranked within their group.
 * `groupOf` returns the board a player belongs on (e.g. "2016" or "all"); players without one are left out.
 */
export function challengeResults(entries: Entry[], groupOf: (player: number) => string | null, direction: Direction, winnersPerGroup: number): ResultRow[] {
  const best = bestPerPlayer(entries, direction)
  const groups = new Map<string, Entry[]>()
  for (const e of best) {
    const g = groupOf(e.player)
    if (!g) continue
    groups.set(g, [...(groups.get(g) ?? []), e])
  }
  const out: ResultRow[] = []
  for (const [group, list] of [...groups.entries()].sort(([a], [b]) => b.localeCompare(a))) {
    for (const r of rank(list, direction)) out.push({ player: r.player, group, value: r.value, rank: r.rank, winner: r.rank <= Math.max(1, winnersPerGroup), at: r.at })
  }
  return out
}
