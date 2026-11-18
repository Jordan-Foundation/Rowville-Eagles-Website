import type { Payload } from 'payload'
import { birthYearOf } from '../lib/age-groups'

/**
 * Bring EOIs across from an old Google Form (exported as .xlsx or .csv). Columns are found by their headings, so any
 * similar form works. Imported players wait for trial dates like any other EOI, but are only messaged after
 * Management previews and presses Send (Eagles selections → Send trial dates).
 */

export type ImportRow = {
  line: number
  parentFirst: string
  parentLast: string
  email: string
  phone: string
  playerFirst: string
  playerLast: string
  dob: string // YYYY-MM-DD
  gender?: 'female' | 'male'
  previousClub?: string
  notes?: string
  marketing: boolean
  answeredAt?: string // ISO
  problem?: string
  duplicate?: string
}

const FIELDS = {
  timestamp: /time\s*stamp|submitted/i,
  parent: /parent|guardian/i,
  phone: /mobile|phone/i,
  email: /e-?mail/i,
  player: /player.*name|child.*name/i,
  dob: /date of birth|\bdob\b|birth ?date/i,
  wantGroup: /age group/i,
  gender: /male|female|gender|sex/i,
  club: /club/i,
  level: /level/i,
  marketing: /news|offer|marketing|updates/i,
} as const
type Field = keyof typeof FIELDS

/** Which column holds what (first heading that matches; the parent column must not be the email/phone one). */
export function mapHeadings(headings: unknown[]) {
  const map: Partial<Record<Field, number>> = {}
  const order: Field[] = ['timestamp', 'email', 'phone', 'dob', 'player', 'marketing', 'wantGroup', 'gender', 'club', 'level', 'parent']
  headings.forEach((h, i) => {
    const text = String(h ?? '')
    const f = order.find((k) => map[k] === undefined && FIELDS[k].test(text))
    if (f) map[f] = i
  })
  return map
}

const clean = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim()
const title = (s: string) => s.replace(/\b([a-z])/g, (m) => m.toUpperCase())
const split = (name: string) => {
  const parts = clean(name).split(' ').filter(Boolean)
  return { first: title(parts[0] ?? ''), last: title(parts.slice(1).join(' ')) }
}

/** A date cell: a real date, an Excel day number, "14/10/2020" (day first) or "2020-10-14". */
export function toYmd(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return new Date(v.getTime() + 12 * 3_600_000).toISOString().slice(0, 10)
  if (typeof v === 'number' && v > 1000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 86_400_000).toISOString().slice(0, 10)
  const s = clean(v)
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  return null
}

/** Pure: spreadsheet rows (first row = headings) → EOIs to import, with problems and in-file duplicates marked (unit tested). */
export function parseEoiSheet(rows: unknown[][], marketingWording?: string) {
  const [head = [], ...body] = rows
  const map = mapHeadings(head)
  const at = (r: unknown[], f: Field) => (map[f] === undefined ? undefined : r[map[f]!])
  const out: ImportRow[] = []
  const seen = new Map<string, number>()
  body.forEach((r, i) => {
    if (!r.some((c) => clean(c))) return
    const parent = split(clean(at(r, 'parent')))
    const player = split(clean(at(r, 'player')))
    // A missing surname: borrow it from the parent / child
    if (!player.last) player.last = parent.last
    if (!parent.last) parent.last = player.last
    const dob = toYmd(at(r, 'dob'))
    const g = clean(at(r, 'gender')).toLowerCase()
    const want = clean(at(r, 'wantGroup'))
    const level = clean(at(r, 'level'))
    const answered = at(r, 'timestamp')
    const row: ImportRow = {
      line: i + 2,
      parentFirst: parent.first,
      parentLast: parent.last,
      email: clean(at(r, 'email')).toLowerCase(),
      phone: clean(at(r, 'phone')).replace(/[^\d+]/g, '').replace(/^4(\d{8})$/, '04$1'),
      playerFirst: player.first,
      playerLast: player.last,
      dob: dob ?? '',
      gender: g.startsWith('f') ? 'female' : g.startsWith('m') ? 'male' : undefined,
      previousClub: clean(at(r, 'club')) || undefined,
      notes: [want && `Asked to play in ${want}`, level && `Current level: ${level}`, 'Brought across from the old Google form'].filter(Boolean).join(' · '),
      marketing: /^y/i.test(clean(at(r, 'marketing'))),
      answeredAt: answered instanceof Date ? answered.toISOString() : toYmd(answered) ? `${toYmd(answered)}T00:00:00.000Z` : undefined,
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) row.problem = 'No valid email'
    else if (!row.playerFirst) row.problem = 'No player name'
    else if (!dob) row.problem = 'No date of birth'
    else if (!row.parentFirst) row.problem = 'No parent name'
    const key = `${row.email}|${row.playerFirst.toLowerCase()}|${row.dob}`
    if (!row.problem && seen.has(key)) row.duplicate = `Same as line ${seen.get(key)}`
    else seen.set(key, row.line)
    out.push(row)
  })
  return { rows: out, columns: map, marketingWording: marketingWording ?? (map.marketing !== undefined ? clean(head[map.marketing]) : undefined) }
}

/** Mark rows already on the site this season (same email + player first name). */
export async function markExisting(p: Payload, rows: ImportRow[], season: number) {
  const emails = [...new Set(rows.map((r) => r.email).filter(Boolean))]
  if (!emails.length) return rows
  const { docs } = await p.find({ collection: 'selection-entries', where: { kind: { equals: 'rowville' }, season: { equals: season }, 'contact.email': { in: emails } }, limit: 5000, pagination: false, depth: 0, overrideAccess: true, select: { contact: true, player: true, reference: true } })
  for (const r of rows) {
    const hit = docs.find((d) => d.contact?.email?.toLowerCase() === r.email && d.player?.firstName?.toLowerCase() === r.playerFirst.toLowerCase())
    if (hit && !r.problem && !r.duplicate) r.duplicate = `Already on the site (${hit.reference})`
  }
  return rows
}

/** Create the EOIs (rows without problems or duplicates). Nobody is messaged. */
export async function importEois(p: Payload, rows: ImportRow[], marketingWording?: string) {
  const { getAgeRules } = await import('../lib/age-rules')
  const { rowvilleRound } = await import('./rounds')
  const { entryFlags } = await import('./entries')
  const { makeReference } = await import('../lib/reference')
  const { newToken } = await import('../lib/trials')
  const rules = await getAgeRules(p)
  const season = rules.season
  await markExisting(p, rows, season)
  const round = await rowvilleRound(p, season)
  let created = 0
  for (const r of rows) {
    if (r.problem || r.duplicate) continue
    const birthYear = birthYearOf(r.dob)
    if (!birthYear) continue
    await p.create({
      collection: 'selection-entries',
      overrideAccess: true,
      context: { skipOffer: true },
      data: {
        reference: makeReference('TRY'),
        round: round.id,
        kind: 'rowville',
        flags: [...entryFlags(birthYear, rules, 'rowville')],
        status: 'interested',
        season,
        birthYear,
        source: 'import',
        token: newToken(),
        contact: { firstName: r.parentFirst, lastName: r.parentLast || '-', email: r.email, phone: r.phone },
        player: { firstName: r.playerFirst, lastName: r.playerLast || '-', dateOfBirth: r.dob, gender: r.gender, previousClub: r.previousClub, notes: r.notes },
        ...(r.marketing ? { marketingOptIn: true, marketingOptInAt: r.answeredAt ?? new Date().toISOString(), marketingWording: (marketingWording ?? '').slice(0, 300) || 'Old form: news, program updates and special offers by email or SMS' } : {}),
      },
    })
    created++
  }
  return { created, skipped: rows.length - created }
}
