/**
 * Age groups (pure — safe for server and browser). One engine for every flow.
 *
 * FV/FA MiniRoos rule: age group number = season year − birth year (e.g. 2026 season: born 2017 → 9s).
 * Groups are identified and labelled by YEAR OF BIRTH everywhere ("2017s"), with the FV group as a hint.
 * The season and the rules are admin settings (Site settings → Age groups), so groups roll over each season.
 *
 * Moving players (MiniRoos only):
 *   up to any older group (earlier birth year) — always allowed
 *   down 1 group — allowed (preferred)
 *   down 2 groups — allowed with a warning and a reason
 *   down more than `maxDown` — blocked
 * Players outside MiniRoos are grouped by birth year with no move rules (staff still give a reason).
 */
import { TZ } from './time'

export type AgeRules = {
  season: number
  /** MiniRoos age numbers, inclusive (default 6–11) */
  miniMin: number
  miniMax: number
  /** Most groups a MiniRoos player can move down (default 2) */
  maxDown: number
  /** Moving down this many groups (or more) shows a warning (default 2) */
  warnDown: number
}

export const DEFAULT_RULES: Omit<AgeRules, 'season'> = { miniMin: 6, miniMax: 11, maxDown: 2, warnDown: 2 }

export type GroupKind = 'too-young' | 'miniroos' | 'junior' | 'senior'

export type AgeGroupInfo = {
  birthYear: number
  /** season − birth year */
  ageNumber: number
  kind: GroupKind
  /** "2017s" */
  label: string
  /** FV name, e.g. "9s" (MiniRoos), "U14" (juniors), "Seniors" */
  hint: string
}

/** Season to use: the admin setting, or (if unset) next year from October onwards. */
export const currentSeason = (setting?: number | null) => setting || new Date().getFullYear() + (new Date().getMonth() >= 9 ? 1 : 0)

/** Birth year in Sydney time (a date saved as local midnight is the previous day in UTC). */
export function birthYearOf(dob: string | Date | null | undefined): number | null {
  if (!dob) return null
  if (typeof dob === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dob)) return Number(dob.slice(0, 4))
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  return Number(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric' }).format(d))
}

export const groupLabel = (birthYear: number) => `${birthYear}s`

export function groupInfo(birthYear: number, rules: AgeRules): AgeGroupInfo {
  const ageNumber = rules.season - birthYear
  const kind: GroupKind = ageNumber < rules.miniMin ? 'too-young' : ageNumber <= rules.miniMax ? 'miniroos' : ageNumber < 18 ? 'junior' : 'senior'
  const hint = kind === 'miniroos' ? `${ageNumber}s` : kind === 'junior' ? `U${ageNumber + 1}` : kind === 'senior' ? 'Seniors' : `Under ${rules.miniMin}`
  return { birthYear, ageNumber, kind, label: kind === 'senior' ? 'Seniors' : groupLabel(birthYear), hint }
}

/** A player's rightful group for the season, or null if the date of birth is missing/invalid. */
export function groupFor(dob: string | Date | null | undefined, rules: AgeRules): AgeGroupInfo | null {
  const by = birthYearOf(dob)
  return by === null ? null : groupInfo(by, rules)
}

/** "2017s · 9s" */
export const fullLabel = (g: AgeGroupInfo) => (g.kind === 'senior' ? 'Seniors' : `${g.label} · ${g.hint}`)

/** MiniRoos birth years for the season, youngest first: e.g. 2026 → [2020 … 2015]. */
export function miniRoosBirthYears(rules: AgeRules) {
  return Array.from({ length: rules.miniMax - rules.miniMin + 1 }, (_, i) => rules.season - rules.miniMin - i)
}

export type MoveCheck = {
  direction: 'none' | 'up' | 'down'
  /** Number of groups moved */
  steps: number
  allowed: boolean
  /** Allowed, but staff must confirm a warning */
  warning: boolean
  /** Whether the MiniRoos rules applied */
  ruled: boolean
  message: string
}

/**
 * Check moving a player from their rightful birth-year group to another. Up = an older group (earlier birth year).
 * Every move needs a reason (enforced by the caller); this decides allowed / warning / blocked.
 */
export function checkMove(rightfulBirthYear: number, targetBirthYear: number, rules: AgeRules): MoveCheck {
  const steps = Math.abs(rightfulBirthYear - targetBirthYear)
  const direction = steps === 0 ? 'none' : targetBirthYear < rightfulBirthYear ? 'up' : 'down'
  const from = groupInfo(rightfulBirthYear, rules)
  const to = groupInfo(targetBirthYear, rules)
  const ruled = from.kind === 'miniroos'
  const g = (n: number) => `${n} age group${n === 1 ? '' : 's'}`
  if (direction === 'none') return { direction, steps, allowed: true, warning: false, ruled, message: 'Playing in their rightful age group.' }
  if (!ruled) return { direction, steps, allowed: true, warning: false, ruled, message: `Outside MiniRoos — no move rules apply (moving ${direction} ${g(steps)} to ${to.label}).` }
  if (direction === 'up') return { direction, steps, allowed: true, warning: false, ruled, message: `Moving up ${g(steps)} to ${fullLabel(to)}.` }
  if (steps > rules.maxDown) {
    return { direction, steps, allowed: false, warning: false, ruled, message: `Players can’t move down more than ${g(rules.maxDown)} (this would be ${steps}).` }
  }
  if (steps >= rules.warnDown) {
    return {
      direction,
      steps,
      allowed: true,
      warning: true,
      ruled,
      message: `Moving down ${g(steps)} to ${fullLabel(to)} — only if the player can’t take part in their rightful age group. Moving down 1 is preferred.`,
    }
  }
  return { direction, steps, allowed: true, warning: false, ruled, message: `Moving down ${g(steps)} to ${fullLabel(to)} (only if they can’t take part in their rightful age group).` }
}

/** "Born 2017 · rightful 2017s (9s) · playing in 2016s (10s)" */
export function placementLabel(rightfulBirthYear: number, playingBirthYear: number | null | undefined, rules: AgeRules) {
  const r = groupInfo(rightfulBirthYear, rules)
  if (!playingBirthYear || playingBirthYear === rightfulBirthYear) return `Born ${rightfulBirthYear} · ${fullLabel(r)}`
  const p = groupInfo(playingBirthYear, rules)
  return `Born ${rightfulBirthYear} · rightful ${r.label} (${r.hint}) · playing in ${p.label} (${p.hint})`
}

/** Convert a legacy "U9" age group (season − birth year + 1) to a birth year. */
export function birthYearFromLegacy(u: string, season: number): number | null {
  const m = /^U(\d{1,2})$/.exec(u)
  return m ? season - Number(m[1]) + 1 : null
}
