/**
 * Match Reflections — pure rules (no database), unit-tested in tests/unit/reflections.spec.ts.
 */

export const MOMENTS_PER_TYPE = 3
export const COMMENT_MIN = 10
export const COMMENT_MAX = 280
export const FOCUS_MIN = 3
export const FOCUS_MAX = 200

export const FEELINGS = [
  { value: 1, emoji: '😞', label: 'Not great' },
  { value: 2, emoji: '😕', label: 'Meh' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Awesome' },
] as const

/** Starting pillars: the six PDR areas (also seeded by the migration). */
export const DEFAULT_PILLARS = [
  { name: 'Physical', hint: 'speed, strength, effort, getting back' },
  { name: 'Passing', hint: 'short and long passing, weight of pass, switching play' },
  { name: 'Dribbling', hint: 'beating a player, running with the ball, 1v1s' },
  { name: 'Control', hint: 'first touch, receiving, shielding' },
  { name: 'Skills', hint: 'turns, feints, shooting, heading' },
  { name: 'Ball Mastery', hint: 'close control, both feet, comfort on the ball' },
]

export type MomentType = 'great' | 'improve'
export type MomentInput = { type: MomentType; pillar?: number | null; comment?: string | null }
export type ReflectionInput = { feeling?: number | null; moments: MomentInput[]; focus?: string | null }

export type WindowSettings = { opensAfterHours: number; closesAfterDays: number }
export const DEFAULT_WINDOW: WindowSettings = { opensAfterHours: 3, closesAfterDays: 4 }

export type ReflectionWindow = { opensAt: Date; closesAt: Date }
export type WindowState = 'upcoming' | 'open' | 'closed'

/**
 * Opens a set time after kick-off; closes a set number of days later or at the team's next kick-off, whichever is first.
 */
export function reflectionWindow(kickoff: string | Date, nextKickoff: string | Date | null | undefined, s: WindowSettings = DEFAULT_WINDOW): ReflectionWindow {
  const k = new Date(kickoff).getTime()
  const opensAt = new Date(k + s.opensAfterHours * 3_600_000)
  let closes = k + s.closesAfterDays * 86_400_000
  if (nextKickoff) {
    const n = new Date(nextKickoff).getTime()
    if (n > opensAt.getTime() && n < closes) closes = n
  }
  return { opensAt, closesAt: new Date(Math.max(closes, opensAt.getTime())) }
}

export function windowState(w: ReflectionWindow, now = new Date()): WindowState {
  const t = now.getTime()
  if (t < w.opensAt.getTime()) return 'upcoming'
  if (t >= w.closesAt.getTime()) return 'closed'
  return 'open'
}

/** The team's next fixture after this one (by kick-off), if any. */
export function nextFixtureAfter<F extends { id?: string | null; startsAt: string }>(fixtures: F[], fixture: { id?: string | null; startsAt: string }): F | null {
  const t = Date.parse(fixture.startsAt)
  return [...fixtures].filter((f) => f.id !== fixture.id && Date.parse(f.startsAt) > t).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null
}

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()

export type ValidationResult = { ok: boolean; errors: string[] }

/** Submit rules: 3 great + 3 to improve, each with a pillar and a 10–280 character comment, then a focus. Feeling is optional. */
export function validateReflection(r: ReflectionInput, pillarIds: number[]): ValidationResult {
  const errors: string[] = []
  if (r.feeling != null && !(Number.isInteger(r.feeling) && r.feeling >= 1 && r.feeling <= 5)) errors.push('Pick how you felt from the faces (or leave it blank).')
  for (const type of ['great', 'improve'] as const) {
    const list = r.moments.filter((m) => m.type === type)
    const name = type === 'great' ? 'Something you did well' : 'Something to work on'
    if (list.length !== MOMENTS_PER_TYPE) errors.push(`Add ${MOMENTS_PER_TYPE} “${type === 'great' ? 'did well' : 'to work on'}” moments.`)
    list.forEach((m, i) => {
      if (!m.pillar || !pillarIds.includes(Number(m.pillar))) errors.push(`${name} #${i + 1}: choose a skill area.`)
      const c = clean(m.comment)
      if (c.length < COMMENT_MIN) errors.push(`${name} #${i + 1}: write at least ${COMMENT_MIN} characters.`)
      if (c.length > COMMENT_MAX) errors.push(`${name} #${i + 1}: keep it under ${COMMENT_MAX} characters.`)
    })
  }
  const f = clean(r.focus)
  if (f.length < FOCUS_MIN) errors.push('Write your focus for the next game.')
  if (f.length > FOCUS_MAX) errors.push(`Keep your focus under ${FOCUS_MAX} characters.`)
  return { ok: errors.length === 0, errors }
}

/** Drafts keep whatever was typed, trimmed to sensible lengths, in a fixed 3 + 3 shape. */
export type DraftMoment = { type: MomentType; position: number; pillar: number | null; comment: string }
export function normaliseDraft(r: ReflectionInput, pillarIds: number[]): { feeling: number | null; moments: DraftMoment[]; focus: string } {
  const moments: DraftMoment[] = []
  for (const type of ['great', 'improve'] as const) {
    const list = r.moments.filter((m) => m.type === type).slice(0, MOMENTS_PER_TYPE)
    for (let i = 0; i < MOMENTS_PER_TYPE; i++) {
      const m = list[i]
      const pillar = m?.pillar && pillarIds.includes(Number(m.pillar)) ? Number(m.pillar) : null
      moments.push({ type, position: i + 1, pillar, comment: (m?.comment ?? '').slice(0, COMMENT_MAX + 20) })
    }
  }
  const feeling = r.feeling != null && Number.isInteger(Number(r.feeling)) && Number(r.feeling) >= 1 && Number(r.feeling) <= 5 ? Number(r.feeling) : null
  return { feeling, moments, focus: (r.focus ?? '').slice(0, FOCUS_MAX + 20) }
}

// ── Safeguarding ───────────────────────────────────────────────────────────

/** Starting list — Management can edit it. Matched as whole words/phrases, case-insensitive. */
export const DEFAULT_WELFARE_KEYWORDS = [
  'hurt me', 'hits me', 'hit me', 'kicked me', 'punched me', 'abuse', 'abused', 'touched me', 'unsafe', 'scared', 'afraid',
  'bullied', 'bully', 'bullying', 'hate myself', 'kill myself', 'want to die', 'suicide', 'self harm', 'self-harm', 'cut myself',
  'hurt myself', 'nobody likes me', 'no one likes me', 'starving', 'not eating', 'threatened', 'secret', 'yelled at me', 'screamed at me',
]

export function parseKeywords(text: string | null | undefined): string[] {
  const list = (text ?? '').split(/[\n,]/).map((k) => k.trim().toLowerCase()).filter(Boolean)
  return [...new Set(list)]
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Keywords found in the text (whole word/phrase matches). */
export function keywordHits(text: string, keywords: string[]): string[] {
  const t = ` ${text.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ')} `
  return keywords.filter((k) => new RegExp(`(^|[^a-z0-9])${escapeRe(k.toLowerCase())}([^a-z0-9]|$)`).test(t))
}

/** Everything the player wrote, each with a label (for flag excerpts). */
export function reflectionTexts(r: { moments?: { type: string; position?: number | null; comment?: string | null }[] | null; focus?: string | null }) {
  const out: { where: string; text: string }[] = []
  for (const m of r.moments ?? []) if (clean(m.comment)) out.push({ where: `${m.type === 'great' ? 'Did well' : 'To work on'} #${m.position ?? ''}`.trim(), text: clean(m.comment) })
  if (clean(r.focus)) out.push({ where: 'Focus', text: clean(r.focus) })
  return out
}

// ── Privacy: nothing identifying goes to the AI ────────────────────────────────

/** Replaces any of the given names (first/last names of players, parents, coaches) with “[name]”, plus emails and phone numbers. */
export function redact(text: string, names: string[]): string {
  let out = text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/(\+?\d[\d\s-]{7,}\d)/g, '[number]')
  const words = [...new Set(names.map((n) => n.trim()).filter((n) => n.length >= 2))].sort((a, b) => b.length - a.length)
  for (const n of words) out = out.replace(new RegExp(`(^|[^\\p{L}])${escapeRe(n)}(?=$|[^\\p{L}])`, 'giu'), '$1[name]')
  return out
}

/** “Player A”, “Player B” … “Player Z”, “Player AA” … */
export function anonLabel(i: number): string {
  let s = ''
  let n = i
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return `Player ${s}`
}

// ── Stats (computed in code, never by the AI) ─────────────────────────────────

export type StatReflection = {
  participant: number
  status: 'draft' | 'submitted'
  feeling?: number | null
  fixtureAt: string
  moments: { type: MomentType; pillar: number | null; pillarName?: string | null }[]
}

export type PillarStat = { pillar: number; name: string; great: number; improve: number }
export type ReflectionStats = {
  submitted: number
  expected: number
  completionRate: number | null
  feelingAverage: number | null
  feelingCount: number
  pillars: PillarStat[]
}

export function computeStats(reflections: StatReflection[], pillars: { id: number; name: string }[], expected: number): ReflectionStats {
  const done = reflections.filter((r) => r.status === 'submitted')
  const by = new Map<number, PillarStat>(pillars.map((p) => [p.id, { pillar: p.id, name: p.name, great: 0, improve: 0 }]))
  for (const r of done) for (const m of r.moments) {
    if (!m.pillar) continue
    const s = by.get(m.pillar) ?? { pillar: m.pillar, name: m.pillarName ?? `Pillar ${m.pillar}`, great: 0, improve: 0 }
    s[m.type] += 1
    by.set(m.pillar, s)
  }
  const feelings = done.map((r) => r.feeling).filter((f): f is number => typeof f === 'number')
  return {
    submitted: done.length,
    expected,
    completionRate: expected > 0 ? Math.min(1, done.length / expected) : null,
    feelingAverage: feelings.length ? Math.round((feelings.reduce((a, b) => a + b, 0) / feelings.length) * 10) / 10 : null,
    feelingCount: feelings.length,
    pillars: [...by.values()],
  }
}

/** Monday 00:00 (local) of the week an instant falls in, as YYYY-MM-DD — used to group by weekend. */
export function weekKey(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  const back = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - back)
  return d.toISOString().slice(0, 10)
}

/** Consecutive reflected games, counting back from the most recent closed-or-done one (an open window doesn't break it). */
export function streak(games: { at: string; reflected: boolean; open?: boolean }[]): number {
  const sorted = [...games].sort((a, b) => b.at.localeCompare(a.at))
  let n = 0
  for (const g of sorted) {
    if (g.reflected) n++
    else if (g.open && n === 0) continue
    else break
  }
  return n
}

// ── Weekly report timing ───────────────────────────────────────────────────

/** The reporting period that has just finished when the report runs: the 7 days before the run day (local), as YYYY-MM-DD [from, to). */
export function reportPeriod(runLocalYmd: string): { from: string; to: string } {
  const to = new Date(`${runLocalYmd}T00:00:00Z`)
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - 7)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

/** Is it time for this week's report? day 0=Sun..6=Sat, hour 0–23 local. */
export function reportDue(local: { weekday: number; hour: number }, setting: { day: number; hour: number }): boolean {
  return local.weekday === setting.day && local.hour >= setting.hour
}
