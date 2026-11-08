/** Shared checks for family-entered details (pure — unit tested). */

/** Australian phone (mobile or landline), spaces/brackets allowed: 0412 345 678, (03) 9876 5432, +61 412 345 678 */
export const AU_PHONE = /^(\+?61|0)[2-478]\d{8}$/
export const phoneOk = (v: string) => AU_PHONE.test(v.replace(/[\s()-]/g, ''))

/** A child's/player's date of birth: a real date, not in the future, not before 1940. Returns an error or null. */
export function dobProblem(v: string, now = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) return 'Please enter a valid date of birth.'
  const d = new Date(`${v}T00:00:00Z`)
  if (d.getTime() > now.getTime()) return 'The date of birth can’t be in the future.'
  if (d.getUTCFullYear() < 1940) return 'Please check the year of birth.'
  return null
}

export const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)
