/**
 * Mini Ballers (toddler program, ages 2–5) — pure rules, unit tested.
 * Age is checked from the date of birth on the day of the first session, separately from the MiniRoos rules.
 */
export const TERM_PROGRAM_TYPES = ['academy-term', 'toddler'] as const
export const isTermProgram = (type?: string | null) => type === 'academy-term' || type === 'toddler'

export const TODDLER_MIN_AGE = 2
export const TODDLER_MAX_AGE = 5

/** Whole years old on a date (Melbourne calendar). */
export function ageOnDate(dob: string, at: Date | string) {
  const d = new Date(`${dob.slice(0, 10)}T12:00:00Z`)
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at))
  const [y, m, day] = ymd.split('-').map(Number)
  let age = y - d.getUTCFullYear()
  if (m < d.getUTCMonth() + 1 || (m === d.getUTCMonth() + 1 && day < d.getUTCDate())) age--
  return age
}

export function toddlerAgeOk(dob: string, at: Date | string): { ok: true } | { ok: false; reason: string } {
  const age = ageOnDate(dob, at)
  if (age < TODDLER_MIN_AGE) return { ok: false, reason: `Mini Ballers is for children aged ${TODDLER_MIN_AGE} to ${TODDLER_MAX_AGE} — your child needs to be ${TODDLER_MIN_AGE} by their first session.` }
  if (age > TODDLER_MAX_AGE) return { ok: false, reason: `Mini Ballers is for children aged ${TODDLER_MIN_AGE} to ${TODDLER_MAX_AGE}. Older players can join MiniRoos or the Foundation Academy.` }
  return { ok: true }
}

/** Years of birth that can be aged 2–5 at some point during a term starting on `start` (for slot matching). */
export function toddlerYears(start: Date | string) {
  const y = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', year: 'numeric' }).format(new Date(start)))
  return [y - 2, y - 3, y - 4, y - 5, y - 6]
}

/** Trial places left at one session: limited by the trial allowance and by the session's capacity. */
export function trialPlacesLeft(o: { trialPlaces: number; trialsBooked: number; capacity: number | null; enrolled: number }) {
  const byTrials = o.trialPlaces - o.trialsBooked
  const byCapacity = o.capacity == null ? Infinity : o.capacity - o.enrolled - o.trialsBooked
  return Math.max(0, Math.min(byTrials, byCapacity))
}
