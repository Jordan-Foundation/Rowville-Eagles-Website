import type { Criteria } from './content'

/**
 * Foundation+ leaderboards and rankings (pure — unit tested).
 *  - Stage boards: each player's best VERIFIED score (coach promotions never count), right direction.
 *  - Area boards: stages passed.
 *  - Names: first name + last initial (or the family's chosen display name); opted-out players hidden.
 *  - Ties share a rank (1, 2, 2, 4).
 */
export type Entry = { player: number; value: number; at?: string | null }
export type Ranked = Entry & { rank: number }

export function displayName(kid: { firstName: string; lastName: string; pdr?: { leaderboardName?: string | null } | null }) {
  const own = kid.pdr?.leaderboardName?.trim()
  return own || `${kid.firstName.trim()} ${kid.lastName.trim().charAt(0).toUpperCase()}.`
}

/** A display name families can choose: letters, spaces, hyphens, apostrophes and full stops, 2–20 characters. */
export const validDisplayName = (s: string) => /^[\p{L}][\p{L} .'’-]{1,19}$/u.test(s.trim())

/** Keep each player's best entry. */
export function bestPerPlayer(entries: Entry[], direction: Criteria['direction'] = 'higher') {
  const best = new Map<number, Entry>()
  for (const e of entries) {
    const cur = best.get(e.player)
    if (!cur || (direction === 'lower' ? e.value < cur.value : e.value > cur.value) || (e.value === cur.value && (e.at ?? '') < (cur.at ?? ''))) best.set(e.player, e)
  }
  return [...best.values()]
}

/** Sort best first and give ranks, ties sharing a rank; earlier achievement listed first within a tie. */
export function rank(entries: Entry[], direction: Criteria['direction'] = 'higher'): Ranked[] {
  const sorted = [...entries].sort((a, b) => (direction === 'lower' ? a.value - b.value : b.value - a.value) || (a.at ?? '').localeCompare(b.at ?? ''))
  let last: number | null = null
  let lastRank = 0
  return sorted.map((e, i) => {
    const r = e.value === last ? lastRank : i + 1
    last = e.value
    lastRank = r
    return { ...e, rank: r }
  })
}

/**
 * Where a score sits among everyone who has passed the stage: "Top 15%" and "better than 72% of players".
 * Null until enough players have passed (minPlayers) so it never singles anyone out.
 */
export function standing(mine: number, all: number[], direction: Criteria['direction'], minPlayers: number) {
  if (all.length < minPlayers) return null
  const better = all.filter((v) => (direction === 'lower' ? v < mine : v > mine)).length
  const worse = all.filter((v) => (direction === 'lower' ? v > mine : v < mine)).length
  const position = better + 1
  const topPct = Math.max(1, Math.ceil((position / all.length) * 100))
  const beatPct = Math.round((worse / Math.max(1, all.length - 1)) * 100)
  return { position, total: all.length, topPct, beatPct }
}

export function standingText(s: NonNullable<ReturnType<typeof standing>>, c: Criteria | null | undefined) {
  const verb = c?.direction === 'lower' && /sec|min|time/i.test(c?.unit ?? '') ? 'Faster' : 'Better'
  if (s.position === 1) return `#1 of ${s.total} players`
  return s.topPct <= 50 ? `Top ${s.topPct}% · ${verb.toLowerCase()} than ${s.beatPct}% of players` : `${verb} than ${s.beatPct}% of players`
}
