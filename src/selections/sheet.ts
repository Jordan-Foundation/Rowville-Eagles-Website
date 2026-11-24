/**
 * Selection trial sheets (pure — unit tested): the players at a trial session, either all on one sheet
 * (youngest age group first, then by name) or one page per age group, with a few blank rows for walk-ins.
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
export type SheetRow = { name: string; born: number | null; group: string; parent: string; phone: string }
export type SheetGroup = { playingYear: number; title: string; short: string; rows: SheetRow[] }
export type SheetLayout = 'combined' | 'groups'

export const BLANK_ROWS = 4

export function sheetGroups(entries: SheetEntry[], rules: AgeRules): SheetGroup[] {
  const by = new Map<number, SheetRow[]>()
  for (const e of entries) {
    const born = birthYearOf(e.dateOfBirth) ?? e.birthYear ?? null
    const playing = e.playingBirthYear ?? e.birthYear ?? born ?? 0
    const row: SheetRow = {
      name: `${e.firstName} ${e.lastName}`.trim(),
      born,
      group: shortLabel(playing, rules),
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
        short: shortLabel(year, rules),
        rows: rows.sort((a, b) => a.name.localeCompare(b.name)),
      }
    })
}

/** "U10" (or "Seniors"); empty when the age group isn't known. */
export function shortLabel(year: number, rules: AgeRules) {
  if (!year) return ''
  const g = groupInfo(year, rules)
  return g.kind === 'senior' ? 'Seniors' : g.hint
}

/** Everyone on one sheet: youngest age group first, then by name. */
export function combineGroups(groups: SheetGroup[]): SheetGroup {
  return { playingYear: 0, title: groups.map((g) => g.short || g.title).join(' · ') || 'All players', short: '', rows: groups.flatMap((g) => g.rows) }
}

/** The sheets to print for a layout. An empty trial still gets a blank sheet (one per age group when split). */
export function sheetsFor(groups: SheetGroup[], layout: SheetLayout, emptyYears: number[], rules: AgeRules): SheetGroup[] {
  const base = groups.length ? groups : emptyYears.map((y) => ({ playingYear: y, title: `${shortLabel(y, rules)} · born ${y}`, short: shortLabel(y, rules), rows: [] as SheetRow[] }))
  if (layout === 'groups') return base
  return base.length ? [combineGroups(base)] : []
}
