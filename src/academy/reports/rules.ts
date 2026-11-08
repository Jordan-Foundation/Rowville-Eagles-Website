/**
 * Player reports — statuses, who may do what, and how players are picked for a report cycle (pure — unit tested).
 */
import { RATINGS, STRANDS, levelFor, type LevelKey, type Rating, type StrandKey } from '../curriculum/levels'

export const REPORT_STATUSES = [
  { value: 'not_started', label: 'Not started' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'returned', label: 'Returned' },
  { value: 'approved', label: 'Approved' },
  { value: 'released', label: 'Released' },
] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]['value']
export const statusLabel = (s: string) => REPORT_STATUSES.find((x) => x.value === s)?.label ?? s

/** Reports the coach still has to do. */
export const OUTSTANDING: ReportStatus[] = ['not_started', 'draft', 'returned']

/** The coach can type into it (it locks once submitted, until Management returns it). */
export const coachCanEdit = (s: ReportStatus) => OUTSTANDING.includes(s)

export type StrandEntry = { strand: string; rating?: Rating | null; comment?: string | null }
export type ReportInput = { strands: StrandEntry[]; overall?: string | null }

export const MAX_COMMENT = 1000
export const MAX_OVERALL = 2000

/** Keep only known strands/ratings, trim and cap the text — what a draft save stores. */
export function cleanEntry(input: ReportInput): { strands: { strand: StrandKey; rating: Rating | null; comment: string }[]; overall: string } {
  const byKey = new Map((input.strands ?? []).map((s) => [s.strand, s]))
  return {
    strands: STRANDS.map(({ key }) => {
      const s = byKey.get(key)
      const rating = s?.rating && (RATINGS as readonly string[]).includes(s.rating) ? s.rating : null
      return { strand: key, rating, comment: String(s?.comment ?? '').slice(0, MAX_COMMENT).trim() }
    }),
    overall: String(input.overall ?? '').slice(0, MAX_OVERALL).trim(),
  }
}

/** Why a report can't be submitted yet (empty = ready): every strand rated + an overall comment. */
export function submitProblems(input: ReportInput): string[] {
  const c = cleanEntry(input)
  const missing = c.strands.filter((s) => !s.rating).map((s) => STRANDS.find((x) => x.key === s.strand)!.name)
  const out: string[] = []
  if (missing.length) out.push(`Choose a rating for ${missing.join(', ')}.`)
  if (c.overall.length < 20) out.push('Write an overall comment (at least a sentence).')
  return out
}

/** A player found in a cycle's programs/teams, before levels and duplicates are worked out. */
export type Candidate = {
  key: string // participant:12 or registration:34 — one report per player per cycle
  name: string
  birthYear: number | null
  playingBirthYear?: number | null
  toddler?: boolean
  coachUserId: number | null
  source: 'term' | 'team'
  sourceLabel: string
  participant?: number | null
  account?: number | null
  registration?: number | null
  team?: number | null
}

export type Planned = Candidate & { level: LevelKey }
export type Skipped = { name: string; reason: string }

/**
 * Which reports to create for a cycle: one per player (the first place they're found wins — term groups are listed
 * first), at their curriculum level. Mini Ballers, players too young or with no date of birth, and players already
 * in the cycle are skipped. A player with no coach is still created (Management assigns one).
 */
export function planReports(candidates: Candidate[], season: number, existingKeys: ReadonlySet<string>) {
  const seen = new Set<string>()
  const create: Planned[] = []
  const skipped: Skipped[] = []
  let already = 0
  for (const c of candidates) {
    if (seen.has(c.key)) continue
    seen.add(c.key)
    if (existingKeys.has(c.key)) { already++; continue }
    const { level, source } = levelFor({ season, birthYear: c.birthYear, playingBirthYear: c.playingBirthYear, toddler: c.toddler })
    if (!level) {
      skipped.push({ name: c.name, reason: source === 'toddler' ? 'Mini Ballers (no curriculum report)' : source === 'unknown' ? 'No date of birth' : 'Too young for Foundation' })
      continue
    }
    create.push({ ...c, level })
  }
  return { create, skipped, already }
}

/** Management actions and the statuses they're allowed from. */
export const canApprove = (s: string) => s === 'submitted'
export const canReturn = (s: string) => s === 'submitted' || s === 'approved'
/** Management can correct a report until it's released (after that, families may have read it). */
export const managementCanEdit = (s: string) => s !== 'released'

export type ReleaseItem = { id: number; firstName: string; accountId: number | null; email: string | null; phone: string | null }
export type FamilyRelease = { key: string; accountId: number | null; email: string | null; phone: string | null; items: ReleaseItem[] }

/** One message per family: reports grouped by account (or by email when there's no account yet). Families with neither are returned separately. */
export function groupByFamily(items: ReleaseItem[]) {
  const families = new Map<string, FamilyRelease>()
  const unreachable: ReleaseItem[] = []
  for (const it of items) {
    const key = it.accountId ? `a:${it.accountId}` : it.email ? `e:${it.email.toLowerCase()}` : null
    if (!key) { unreachable.push(it); continue }
    const f = families.get(key) ?? { key, accountId: it.accountId, email: it.email, phone: it.phone, items: [] }
    f.email ??= it.email
    f.phone ??= it.phone
    f.items.push(it)
    families.set(key, f)
  }
  return { families: [...families.values()], unreachable }
}

/** "Ava", "Ava & Leo", "Ava, Leo & Mia" */
export function namesList(names: string[]) {
  const u = [...new Set(names)]
  return u.length <= 1 ? (u[0] ?? '') : `${u.slice(0, -1).join(', ')} & ${u.at(-1)}`
}
