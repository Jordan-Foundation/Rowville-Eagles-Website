/**
 * Football Victoria age groups: a player's age group for season Y is U(Y − birthYear + 1).
 * e.g. born 2019 → U9 in 2027. 18+ in the season year → Seniors.
 */
export const AGE_GROUPS = [
  'U5', 'U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'Seniors',
] as const
export type AgeGroup = (typeof AGE_GROUPS)[number]

export const ageGroupOptions = AGE_GROUPS.map((g) => ({ label: g, value: g }))

export function ageGroupFor(dateOfBirth: string | Date, season: number): AgeGroup | null {
  const d = new Date(dateOfBirth)
  if (Number.isNaN(d.getTime())) return null
  const n = season - d.getUTCFullYear() + 1
  if (n < 5) return null
  if (n > 18) return 'Seniors'
  return `U${n}` as AgeGroup
}

export const currentSeason = (setting?: number | null) => setting || new Date().getFullYear() + (new Date().getMonth() >= 9 ? 1 : 0)
