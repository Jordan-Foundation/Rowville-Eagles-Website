/**
 * Promotions — who a promotion goes to (pure — unit tested).
 * Within one filter any match counts ("RFA or Foundation+"); different filters must all match
 * ("RFA families with a player born in 2016").
 */
export type Audience = {
  mode: 'all' | 'filter' | 'picked'
  memberships?: string[] // rowville | rfa | foundation-plus
  history?: string[] // program:<id> | 1on1 | shop
  birthYears?: number[]
  teams?: number[]
  emails?: string // hand-picked (also added on top of a filter)
}

export type Family = { userId: number; email: string; memberships: Set<string>; history: Set<string>; birthYears: Set<number>; teams: Set<number> }

const any = <T,>(want: T[] | undefined, have: Set<T>) => !want?.length || want.some((w) => have.has(w))

export function matchesAudience(a: Audience, f: Family) {
  if (a.mode === 'all') return true
  if (a.mode === 'picked') return false // picked families are added by email below
  const used = [a.memberships, a.history, a.birthYears, a.teams].some((x) => x?.length)
  if (!used) return false
  return any(a.memberships, f.memberships) && any(a.history, f.history) && any(a.birthYears, f.birthYears) && any(a.teams, f.teams)
}

export const parseEmails = (s: string | undefined) => [...new Set((s ?? '').toLowerCase().split(/[\s,;]+/).map((e) => e.trim()).filter((e) => e.includes('@')))]

/** The audience's families (user ids), and any hand-picked emails with no account. */
export function audienceIds(a: Audience, families: Family[]) {
  const ids = new Set(families.filter((f) => matchesAudience(a, f)).map((f) => f.userId))
  const picked = parseEmails(a.emails)
  const byEmail = new Map(families.map((f) => [f.email.toLowerCase(), f.userId]))
  const unknown: string[] = []
  for (const e of picked) {
    const id = byEmail.get(e)
    if (id) ids.add(id)
    else unknown.push(e)
  }
  return { ids: [...ids], unknown }
}

/** SMS: keep it short and always end with the opt-out (required for marketing texts). */
export const SMS_MAX = 300
export const OPT_OUT = 'Reply STOP to opt out'
export function smsBody(text: string, sender: string) {
  const body = text.trim().replace(/\s+/g, ' ')
  return `${body}${/[.!?]$/.test(body) ? '' : '.'} – ${sender}. ${OPT_OUT}`
}
