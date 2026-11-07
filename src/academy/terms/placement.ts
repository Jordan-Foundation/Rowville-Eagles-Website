import { checkMove, groupLabel, type AgeRules, type MoveCheck } from '../../lib/age-groups'

/**
 * Putting a player in a training time. If the time includes their own year of birth they play there
 * as normal; otherwise they play "in" the closest year the time takes (an older year preferred, since
 * moving up is always allowed) and the age rules decide whether that's allowed.
 */
export type SlotPlacement = {
  /** Year of birth they'll play in (null = their own) */
  playingBirthYear: number | null
  /** A move outside their own age group (needs a reason) */
  isMove: boolean
  check: MoveCheck | null
}

export function placeInSlot(rightful: number, slotYears: number[], rules: AgeRules): SlotPlacement {
  if (!slotYears.length || slotYears.includes(rightful)) return { playingBirthYear: null, isMove: false, check: null }
  const sorted = [...slotYears].sort((a, b) => Math.abs(a - rightful) - Math.abs(b - rightful) || a - b)
  // Closest allowed year first; if none is allowed, report the closest
  const checks = sorted.map((y) => ({ y, c: checkMove(rightful, y, rules) }))
  const pick = checks.find((x) => x.c.allowed) ?? checks[0]
  return { playingBirthYear: pick.y, isMove: true, check: pick.c }
}

export const moveText = (rightful: number, playing: number | null | undefined) =>
  playing && playing !== rightful ? `${groupLabel(rightful)} → plays in ${groupLabel(playing)}` : groupLabel(rightful)
