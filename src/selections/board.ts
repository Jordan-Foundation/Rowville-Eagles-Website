import type { SelectionEntry } from '@/payload-types'
import { groupLabel } from '../lib/age-groups'

/** Selection dashboard helpers (pure). */

export type Tab = 'interest' | 'unpaid' | 'paid' | 'unsuccessful' | 'moved' | 'queued' | 'all'

export const TABS: { key: Tab; label: string }[] = [
  { key: 'interest', label: 'Interest' },
  { key: 'unpaid', label: 'Selected — unpaid' },
  { key: 'paid', label: 'Paid' },
  { key: 'unsuccessful', label: 'Unsuccessful' },
  { key: 'moved', label: 'Moved age group' },
  { key: 'queued', label: 'Review & send' },
  { key: 'all', label: 'All' },
]

type E = Pick<SelectionEntry, 'status' | 'birthYear' | 'playingBirthYear' | 'outcomeQueued'>

export const playingYear = (e: Pick<SelectionEntry, 'birthYear' | 'playingBirthYear'>) => e.playingBirthYear ?? e.birthYear ?? 0
export const isMoved = (e: Pick<SelectionEntry, 'birthYear' | 'playingBirthYear'>) => Boolean(e.playingBirthYear && e.birthYear && e.playingBirthYear !== e.birthYear)

export function inTab(e: E, tab: Tab) {
  switch (tab) {
    case 'interest':
      return ['interested', 'trial-booked', 'attended'].includes(e.status)
    case 'unpaid':
      return e.status === 'selected' || e.status === 'offered'
    case 'paid':
      return e.status === 'registered'
    case 'unsuccessful':
      return e.status === 'unsuccessful'
    case 'moved':
      return isMoved(e) && !['withdrawn', 'closed', 'released'].includes(e.status)
    case 'queued':
      return Boolean(e.outcomeQueued)
    default:
      return true
  }
}

/** Group by the age group they're playing in, oldest group first. */
export function groupByYear<T extends Pick<SelectionEntry, 'birthYear' | 'playingBirthYear'>>(entries: T[]) {
  const m = new Map<number, T[]>()
  for (const e of entries) m.set(playingYear(e), [...(m.get(playingYear(e)) ?? []), e])
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([year, list]) => ({ year, label: year ? groupLabel(year) : 'No date of birth', entries: list }))
}

/** Which outcome "pick" means for this kind of round. */
export const pickOutcome = (kind: 'tournament' | 'rowville') => (kind === 'tournament' ? 'selected' : 'successful')

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n'
}
