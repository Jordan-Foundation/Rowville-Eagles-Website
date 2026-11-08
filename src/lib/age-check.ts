/** Instant age check on booking forms (pure — unit tested). */

/** Age range from the program's own numbers, or read from text like "Ages 5–13", "Ages 2–5", "U8 – U14", "8-12 years". */
export function ageBounds(p: { minAge?: number | null; maxAge?: number | null; ageRange?: string | null }): { min: number | null; max: number | null } {
  if (p.minAge != null || p.maxAge != null) return { min: p.minAge ?? null, max: p.maxAge ?? null }
  const t = (p.ageRange ?? '').replace(/\s+/g, ' ')
  // "U8 – U14" means under-8 to under-14 → ages 7–13
  const u = /U(\d{1,2})\s*[–-]\s*U(\d{1,2})/i.exec(t)
  if (u) return { min: Number(u[1]) - 1, max: Number(u[2]) - 1 }
  const r = /(\d{1,2})\s*(?:[–-]|to)\s*(\d{1,2})/.exec(t)
  if (r) return { min: Number(r[1]), max: Number(r[2]) }
  const plus = /(\d{1,2})\s*\+/.exec(t)
  if (plus) return { min: Number(plus[1]), max: null }
  return { min: null, max: null }
}

/** Whole years old on a date (default today), from YYYY-MM-DD. */
export function ageOn(dob: string, on = new Date()) {
  const [y, m, d] = dob.slice(0, 10).split('-').map(Number)
  let age = on.getFullYear() - y
  if (on.getMonth() + 1 < m || (on.getMonth() + 1 === m && on.getDate() < d)) age--
  return age
}

export type AgeCheck = { ok: boolean; message: string } | null

/** "Ava is 8 — right age for this program ✓" / "Ava is 4 — this program is for ages 5–13". null when unknown. */
export function checkAge(dob: string, bounds: { min: number | null; max: number | null }, name: string, on = new Date()): AgeCheck {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || (bounds.min == null && bounds.max == null)) return null
  const age = ageOn(dob, on)
  if (age < 0 || age > 99) return null
  const who = name.trim() || 'Your player'
  const range = bounds.max == null ? `${bounds.min}+` : bounds.min == null ? `up to ${bounds.max}` : `${bounds.min}–${bounds.max}`
  if ((bounds.min != null && age < bounds.min) || (bounds.max != null && age > bounds.max)) return { ok: false, message: `${who} is ${age} — this program is for ages ${range}. Please check, or contact us first.` }
  return { ok: true, message: `${who} is ${age} — right age for this program ✓` }
}
