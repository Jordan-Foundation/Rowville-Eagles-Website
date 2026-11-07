/**
 * Player Development Report — content rules shared by the admin, seed and player pages.
 * Areas → levels (1, 2, 3 … add more in the admin) → stages (1–4 per level, each its own skill).
 */
export const AREAS = [
  { name: 'Physical', slug: 'physical', hasLeaderboard: true, colour: '#ef4444' },
  { name: 'Passing', slug: 'passing', hasLeaderboard: true, colour: '#3b82f6' },
  { name: 'Dribbling', slug: 'dribbling', hasLeaderboard: true, colour: '#f59e0b' },
  { name: 'Control', slug: 'control', hasLeaderboard: true, colour: '#10b981' },
  { name: 'Skills', slug: 'skills', hasLeaderboard: false, colour: '#a855f7' },
  { name: 'Ball Mastery', slug: 'ball-mastery', hasLeaderboard: true, colour: '#06b6d4' },
] as const

export const START_LEVELS = 3
export const STAGES_PER_LEVEL = 4
export const PLACEHOLDER = 'PLACEHOLDER'

/** "Passing 1.1" */
export const stageCode = (area: string, level: number, stage: number) => `${area} ${level}.${stage}`
export const levelTitle = (area: string, level: number) => `${area} · Level ${level}`

export type Criteria = { target?: number | null; unit?: string | null; timeLimitSec?: number | null; distanceM?: number | null; direction?: 'higher' | 'lower' | null }

/** "30 passes in 30 seconds from 1 m" */
export function criteriaSummary(c: Criteria | null | undefined) {
  if (!c?.target) return ''
  return [`${c.target} ${c.unit ?? ''}`.trim(), c.timeLimitSec ? `in ${c.timeLimitSec} seconds` : '', c.distanceM ? `from ${c.distanceM} m` : ''].filter(Boolean).join(' ')
}

/** A scored stage needs a target, a unit and which way is better. */
export function criteriaProblem(scoring: string | null | undefined, c: Criteria | null | undefined): string | null {
  if (scoring !== 'scored') return null
  if (!c?.target || c.target <= 0) return 'Scored stages need a target above 0'
  if (!c.unit?.trim()) return 'Scored stages need a unit, e.g. passes, seconds, metres'
  if (c.direction !== 'higher' && c.direction !== 'lower') return 'Choose whether a higher or lower score is better'
  return null
}

/** Badge names to start with (everything else is a placeholder to rename in the admin). */
export const NAMED_BADGES: Record<string, string> = { 'physical:3': 'Beast Mode', 'dribbling:2': 'Can’t Touch This' }
