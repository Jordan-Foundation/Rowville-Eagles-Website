/**
 * Foundation Football Curriculum — strands, levels and how a player's report level is worked out (pure — unit tested).
 * Levels: Foundation (up to age 7), then one per age year 8–13. A player's age = season − year of birth (the same
 * rule as the club's age groups), so a 2018-born player is Age 9 in the 2027 season.
 */
export const STRANDS = [
  { key: 'ATT', name: 'Attacking' },
  { key: 'DEF', name: 'Defending' },
  { key: 'PHY', name: 'Physical' },
  { key: 'PAS', name: 'Passing & Receiving' },
  { key: 'TAC', name: 'Tactical' },
  { key: 'CHA', name: 'Character' },
] as const
export type StrandKey = (typeof STRANDS)[number]['key']

export const LEVELS = [
  { key: 'F', name: 'Foundation', long: 'Foundation (up to age 7)', phase: 'Discovery' },
  { key: '8', name: 'Age 8', long: 'Age 8', phase: 'Discovery' },
  { key: '9', name: 'Age 9', long: 'Age 9', phase: 'Skill Acquisition' },
  { key: '10', name: 'Age 10', long: 'Age 10', phase: 'Skill Acquisition' },
  { key: '11', name: 'Age 11', long: 'Age 11', phase: 'Skill Acquisition' },
  { key: '12', name: 'Age 12', long: 'Age 12', phase: 'Skill Acquisition' },
  { key: '13', name: 'Age 13', long: 'Age 13', phase: 'Game Training' },
] as const
export type LevelKey = (typeof LEVELS)[number]['key']

export const RATINGS = ['well_below', 'below', 'at', 'above', 'well_above'] as const
export type Rating = (typeof RATINGS)[number]
export const RATING_LABEL: Record<Rating, string> = { well_below: 'Well below', below: 'Below', at: 'At', above: 'Above', well_above: 'Well above' }

export const strandName = (k: string) => STRANDS.find((s) => s.key === k)?.name ?? k
export const levelName = (k: string) => LEVELS.find((l) => l.key === k)?.name ?? k
export const isLevel = (k: unknown): k is LevelKey => LEVELS.some((l) => l.key === k)

/** Youngest age reported on (Foundation spans roughly 5–7; Mini Ballers players don't get curriculum reports). */
export const MIN_REPORT_AGE = 5

/** The curriculum level for an age number (season − year of birth), or null if too young to report on. */
export function levelForAge(ageNumber: number): LevelKey | null {
  if (!Number.isFinite(ageNumber) || ageNumber < MIN_REPORT_AGE) return null
  if (ageNumber <= 7) return 'F'
  if (ageNumber >= 13) return '13'
  return String(ageNumber) as LevelKey
}

/**
 * A player's report level. In order: a level set on the report itself, then the age group they've been moved
 * into (playing up/down in their team or term group), then their own age group.
 */
export function levelFor(o: { season: number; birthYear: number | null; playingBirthYear?: number | null; override?: string | null; toddler?: boolean }) {
  if (o.toddler) return { level: null, ageNumber: null, source: 'toddler' as const }
  if (isLevel(o.override)) return { level: o.override, ageNumber: o.birthYear ? o.season - o.birthYear : null, source: 'override' as const }
  const year = o.playingBirthYear ?? o.birthYear
  if (!year) return { level: null, ageNumber: null, source: 'unknown' as const }
  const level = levelForAge(o.season - year)
  return { level, ageNumber: o.season - (o.birthYear ?? year), source: o.playingBirthYear && o.playingBirthYear !== o.birthYear ? ('moved' as const) : ('age' as const) }
}
