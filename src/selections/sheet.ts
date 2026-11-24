/**
 * Selection trial sheets (pure — unit tested): the players at a trial session, one section per age group
 * (youngest first), each sorted by name, with a few blank rows for walk-ins.
 */
import { birthYearOf, groupInfo, type AgeRules } from '@/lib/age-groups'

export type SheetEntry = {
  firstName: string
  lastName: string
  dateOfBirth?: string | null
  birthYear?: number | null
  playingBirthYear?: number | null
  parentFirst?: string | null
  parentLast?: string | null
  phone?: string | null
}
export type SheetRow = { name: string; born: number | null; parent: string; phone: string }
export type SheetGroup = { playingYear: number; title: string; rows: SheetRow[] }

export const BLANK_ROWS = 4

export function sheetGroups(entries: SheetEntry[], rules: AgeRules): SheetGroup[] {
  const by = new Map<number, SheetRow[]>()
  for (const e of entries) {
    const born = birthYearOf(e.dateOfBirth) ?? e.birthYear ?? null
    const playing = e.playingBirthYear ?? e.birthYear ?? born ?? 0
    const row: SheetRow = {
      name: `${e.firstName} ${e.lastName}`.trim(),
      born,
      parent: [e.parentFirst, e.parentLast].filter(Boolean).join(' '),
      phone: (e.phone ?? '').trim(),
    }
    by.set(playing, [...(by.get(playing) ?? []), row])
  }
  return [...by.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, rows]) => {
      const g = year ? groupInfo(year, rules) : null
      return {
        playingYear: year,
        title: g ? (g.kind === 'senior' ? 'Seniors' : `${g.hint} · born ${year}`) : 'Age group not set',
        rows: rows.sort((a, b) => a.name.localeCompare(b.name)),
      }
    })
}
