import { groupInfo, type AgeRules } from '../lib/age-groups'

/**
 * Shirt numbers (pure — unit tested). Each junior/MiniRoos year of birth has a stored number range; ranges alternate
 * 51–99 / 2–50 from the youngest year, so a year's range is fixed by its parity and never shifts between seasons.
 * Number 1 is the goalkeeper top and can never be a player's number. Seniors (18+) don't pick numbers.
 */
export type Range = { birthYear: number; start: number; end: number }
export const HIGH = { start: 51, end: 99 } as const
export const LOW = { start: 2, end: 50 } as const
export const HOLD_MINUTES = 10

/** A range is valid if it's inside 2–99 (never 1) and start ≤ end. */
export function rangeProblem(r: { start: number; end: number }) {
  if (!Number.isInteger(r.start) || !Number.isInteger(r.end)) return 'Use whole numbers.'
  if (r.start <= 1 || r.end <= 1) return 'Number 1 is the goalkeeper top — ranges start at 2 or higher.'
  if (r.end > 99) return 'Numbers go up to 99.'
  if (r.start > r.end) return 'The range must start before it ends.'
  return null
}

/** Players who pick a number: MiniRoos and juniors (and younger Academy players) — not seniors. */
export const picksNumber = (birthYear: number | null | undefined, rules: AgeRules) => Boolean(birthYear) && groupInfo(birthYear!, rules).kind !== 'senior'

/** The first ranges: this season's youngest MiniRoos year 51–99, the next 2–50, alternating up to the oldest junior year. */
export function seedRanges(rules: AgeRules): Range[] {
  const youngest = rules.season - rules.miniMin
  const out: Range[] = []
  for (let i = 0; youngest - i > rules.season - 18; i++) out.push({ birthYear: youngest - i, ...(i % 2 === 0 ? HIGH : LOW) })
  return out
}

/** The stored range for a year — or, for a year not stored yet (a new, younger year), continue the alternation from the nearest stored year. */
export function rangeFor(birthYear: number, stored: Range[]): Range | null {
  const exact = stored.find((r) => r.birthYear === birthYear)
  if (exact) return exact
  if (!stored.length) return null
  const anchor = [...stored].sort((a, b) => Math.abs(a.birthYear - birthYear) - Math.abs(b.birthYear - birthYear))[0]
  const anchorIsHigh = anchor.start >= 51
  const same = Math.abs(anchor.birthYear - birthYear) % 2 === 0
  return { birthYear, ...((same ? anchorIsHigh : !anchorIsHigh) ? HIGH : LOW) }
}

/** Numbers in a range a player may pick (never 1), and which are free. */
export function numbersIn(r: { start: number; end: number }) {
  const out: number[] = []
  for (let n = Math.max(2, r.start); n <= Math.min(99, r.end); n++) out.push(n)
  return out
}
export const freeNumbers = (r: { start: number; end: number }, taken: Iterable<number>) => {
  const t = new Set(taken)
  return numbersIn(r).filter((n) => !t.has(n))
}

/** The key that makes a number unique within a year of birth while it's held or in use (cleared when released). */
export const slotKey = (birthYear: number, number: number) => `${birthYear}-${number}`
