/**
 * Existing player import (pure — unit tested): read the "Players" sheet of the template, clean every value and
 * check each row. Columns are matched by their heading (any order, case, trailing "*" ignored).
 * Nothing here touches the database; the server passes in what it needs to know (teams, numbers, accounts…).
 */

export const COLUMNS = [
  { key: 'parent1First', header: 'Parent 1 first name', required: true },
  { key: 'parent1Last', header: 'Parent 1 last name', required: true },
  { key: 'parent1Email', header: 'Parent 1 email', required: true },
  { key: 'parent1Mobile', header: 'Parent 1 mobile', required: true },
  { key: 'parent1Relationship', header: 'Parent 1 relationship' },
  { key: 'parent2First', header: 'Parent 2 first name' },
  { key: 'parent2Last', header: 'Parent 2 last name' },
  { key: 'parent2Email', header: 'Parent 2 email' },
  { key: 'parent2Mobile', header: 'Parent 2 mobile' },
  { key: 'sendParent2', header: 'Send messages to Parent 2?' },
  { key: 'suburb', header: 'Suburb' },
  { key: 'postcode', header: 'Postcode' },
  { key: 'playerFirst', header: 'Player first name', required: true },
  { key: 'playerLast', header: 'Player last name', required: true },
  { key: 'dob', header: 'Date of birth', required: true },
  { key: 'gender', header: 'Gender' },
  { key: 'playerMobile', header: 'Player mobile' },
  { key: 'playerEmail', header: 'Player email' },
  { key: 'eagles', header: 'Rowville Eagles player?', required: true },
  { key: 'team', header: 'Eagles team' },
  { key: 'position', header: 'Position', required: true },
  { key: 'rfa', header: 'RFA player?', required: true },
  { key: 'registration', header: 'Registration status' },
  { key: 'paidBefore', header: 'Paid for 1-on-1s, camps or academy before?' },
  { key: 'number', header: 'Shirt number', required: true },
  { key: 'shirtSize', header: 'Shirt size' },
  { key: 'shortsSize', header: 'Shorts size' },
  { key: 'jacketSize', header: 'Jacket size' },
  { key: 'emergencyName', header: 'Emergency contact name' },
  { key: 'emergencyMobile', header: 'Emergency contact mobile' },
  { key: 'medical', header: 'Medical conditions / allergies' },
  { key: 'photoConsent', header: 'Photo consent?' },
  { key: 'notes', header: 'Notes (Management only)' },
] as const
export type ColumnKey = (typeof COLUMNS)[number]['key']
/** Calculated helper columns in the template — read past, never imported. */
export const IGNORED = ['birth year', 'check', 'import result']

export const normHeader = (h: unknown) => String(h ?? '').replace(/\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
const clean = (v: unknown) => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object' && v && 'text' in v) return String((v as { text: unknown }).text ?? '').replace(/\s+/g, ' ').trim()
  if (typeof v === 'object' && v && 'result' in v) return String((v as { result: unknown }).result ?? '').replace(/\s+/g, ' ').trim()
  if (v instanceof Date) return v.toISOString()
  return String(v).replace(/\s+/g, ' ').trim()
}

/** Australian mobile → E.164 (+614XXXXXXXX), accepting 04…, 4… (Excel dropped the 0), +614… and 614…; null if it isn't one. */
export function toMobile(v: unknown): string | null {
  const d = clean(v).replace(/[\s\-().]/g, '')
  if (/^04\d{8}$/.test(d)) return `+61${d.slice(1)}`
  if (/^4\d{8}$/.test(d)) return `+61${d}`
  if (/^\+614\d{8}$/.test(d)) return d
  if (/^614\d{8}$/.test(d)) return `+${d}`
  return null
}

/** A date cell: a real date, an Excel day number, "dd/mm/yyyy" (never US mm/dd) or "yyyy-mm-dd". Null if not a real date. */
export function toDob(v: unknown): string | null {
  let ymd: string | null = null
  if (v instanceof Date && !Number.isNaN(v.getTime())) ymd = new Date(v.getTime() + 12 * 3_600_000).toISOString().slice(0, 10)
  else if (typeof v === 'number' && v > 1000 && v < 80000) ymd = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000).toISOString().slice(0, 10)
  else {
    const s = clean(v)
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/)
    if (m) ymd = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
    m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})$/)
    if (m) ymd = `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    if (!ymd && /^\d{4,5}(\.\d+)?$/.test(s)) return toDob(Number(s))
  }
  if (!ymd) return null
  // Reject impossible dates like 31/02
  const d = new Date(`${ymd}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ymd ? ymd : null
}

export function toYesNo(v: unknown): boolean | null | 'bad' {
  const s = clean(v).toLowerCase()
  if (!s) return null
  if (['yes', 'y', 'true', '1'].includes(s)) return true
  if (['no', 'n', 'false', '0'].includes(s)) return false
  return 'bad'
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GENDERS: Record<string, string> = { m: 'male', male: 'male', boy: 'male', f: 'female', female: 'female', girl: 'female', 'non-binary': 'non-binary', nonbinary: 'non-binary', 'prefer not to say': 'prefer-not-to-say' }

export type ImportRow = {
  line: number
  raw: Partial<Record<ColumnKey, string>>
  parent1: { first: string; last: string; email: string; mobile: string | null; relationship: string }
  parent2: { first: string; last: string; email: string; mobile: string | null; send: boolean } | null
  suburb: string
  postcode: string
  player: { first: string; last: string; dob: string | null; birthYear: number | null; gender: string | null; mobile: string | null; email: string }
  eagles: boolean
  team: string
  goalkeeper: boolean
  rfa: boolean
  registration: 'paid' | 'not_paid' | 'na'
  paidBefore: boolean
  number: number | null
  sizes: { shirt: string; shorts: string; jacket: string }
  emergency: { name: string; mobile: string | null }
  medical: string
  photoConsent: boolean | null
  notes: string
  errors: string[]
  warnings: string[]
  info: string[]
}

/** Read the sheet: headings in row 1, players from row 2; empty rows skipped. */
export function parsePlayerSheet(rows: unknown[][]): { rows: ImportRow[]; missing: string[] } {
  const [head = [], ...body] = rows
  const index = new Map<string, number>()
  head.forEach((h, i) => {
    const n = normHeader(h)
    if (n && !index.has(n)) index.set(n, i)
  })
  const missing = COLUMNS.filter((c) => 'required' in c && c.required && !index.has(normHeader(c.header))).map((c) => c.header)
  if (missing.length) return { rows: [], missing }
  const out: ImportRow[] = []
  body.forEach((r, i) => {
    const cell = (k: ColumnKey) => {
      const col = COLUMNS.find((c) => c.key === k)!
      const at = index.get(normHeader(col.header))
      return at === undefined ? undefined : r[at]
    }
    const raw: Partial<Record<ColumnKey, string>> = {}
    for (const c of COLUMNS) raw[c.key] = clean(cell(c.key))
    if (!Object.values(raw).some(Boolean)) return
    const errors: string[] = []
    const warnings: string[] = []
    const info: string[] = []
    const need = (k: ColumnKey, label: string) => { if (!raw[k]) errors.push(`${label} is missing`) }
    need('parent1First', 'Parent 1 first name')
    need('parent1Last', 'Parent 1 last name')
    need('parent1Email', 'Parent 1 email')
    need('parent1Mobile', 'Parent 1 mobile')
    need('playerFirst', 'Player first name')
    need('playerLast', 'Player last name')
    need('dob', 'Date of birth')
    need('eagles', 'Rowville Eagles player?')
    need('position', 'Position')
    need('rfa', 'RFA player?')
    need('number', 'Shirt number')

    const email1 = (raw.parent1Email ?? '').toLowerCase()
    if (email1 && !EMAIL.test(email1)) errors.push(`Parent 1 email “${raw.parent1Email}” isn’t a valid email`)
    const mobile1 = toMobile(cell('parent1Mobile'))
    if (raw.parent1Mobile && !mobile1) errors.push(`Parent 1 mobile “${raw.parent1Mobile}” isn’t an Australian mobile`)

    const dob = raw.dob ? toDob(cell('dob')) : null
    if (raw.dob && !dob) errors.push(`Date of birth “${raw.dob}” isn’t a valid date (use dd/mm/yyyy)`)

    const yn = (k: ColumnKey, label: string, required = false) => {
      const v = toYesNo(raw[k])
      if (v === 'bad') { errors.push(`${label} must be Yes or No (got “${raw[k]}”)`); return false }
      if (v === null && required) return false
      return Boolean(v)
    }
    const eagles = yn('eagles', 'Rowville Eagles player?', true)
    const rfa = yn('rfa', 'RFA player?', true)
    const paidBefore = yn('paidBefore', 'Paid for 1-on-1s, camps or academy before?')
    const send2 = yn('sendParent2', 'Send messages to Parent 2?')
    const photo = toYesNo(raw.photoConsent)
    if (photo === 'bad') errors.push(`Photo consent? must be Yes or No (got “${raw.photoConsent}”)`)

    const pos = (raw.position ?? '').toLowerCase()
    const goalkeeper = /^(gk|goal ?keeper|keeper|goalie)$/.test(pos)
    if (raw.position && !goalkeeper && !/^outfield$/.test(pos)) errors.push(`Position must be Goalkeeper or Outfield (got “${raw.position}”)`)

    const numText = raw.number ?? ''
    const number = /^\d{1,2}$/.test(numText) ? Number(numText) : null
    if (numText && (number === null || number < 1 || number > 99)) errors.push(`Shirt number must be 1–99 (got “${numText}”)`)
    if (number === 1 && raw.position && !goalkeeper) errors.push('Number 1 is for goalkeepers only')

    const reg = (raw.registration ?? '').toLowerCase().replace(/[^a-z/]/g, '')
    const registration: ImportRow['registration'] = reg === 'paid' ? 'paid' : reg === 'notpaid' || reg === 'unpaid' ? 'not_paid' : 'na'
    if (raw.registration && !['paid', 'notpaid', 'unpaid', 'na', 'n/a'].includes(reg)) errors.push(`Registration status must be Paid, Not paid or N/A (got “${raw.registration}”)`)

    const gender = raw.gender ? GENDERS[raw.gender.toLowerCase()] ?? null : null
    if (raw.gender && !gender) warnings.push(`Gender “${raw.gender}” not recognised — left blank`)

    const email2 = (raw.parent2Email ?? '').toLowerCase()
    if (email2 && !EMAIL.test(email2)) errors.push(`Parent 2 email “${raw.parent2Email}” isn’t a valid email`)
    const mobile2 = raw.parent2Mobile ? toMobile(cell('parent2Mobile')) : null
    if (raw.parent2Mobile && !mobile2) errors.push(`Parent 2 mobile “${raw.parent2Mobile}” isn’t an Australian mobile`)
    const p2 = raw.parent2First || email2 || raw.parent2Mobile ? { first: raw.parent2First ?? '', last: raw.parent2Last ?? '', email: email2, mobile: mobile2, send: send2 } : null
    if (p2 && email2 && email2 === email1) warnings.push('Parent 2 email is the same as Parent 1 — Parent 2 won’t get a separate login')
    if (send2 && p2 && !email2) errors.push('Send messages to Parent 2? is Yes but Parent 2 has no email')
    if (!p2) info.push('No Parent 2 contact')

    const playerMobile = raw.playerMobile ? toMobile(cell('playerMobile')) : null
    if (raw.playerMobile && !playerMobile) warnings.push(`Player mobile “${raw.playerMobile}” isn’t an Australian mobile — left blank`)
    const emMobile = raw.emergencyMobile ? toMobile(cell('emergencyMobile')) : null
    if (raw.emergencyMobile && !emMobile) warnings.push(`Emergency contact mobile “${raw.emergencyMobile}” isn’t an Australian mobile — kept as typed`)

    out.push({
      line: i + 2,
      raw,
      parent1: { first: raw.parent1First ?? '', last: raw.parent1Last ?? '', email: email1, mobile: mobile1, relationship: raw.parent1Relationship ?? '' },
      parent2: p2,
      suburb: raw.suburb ?? '',
      postcode: raw.postcode ?? '',
      player: { first: raw.playerFirst ?? '', last: raw.playerLast ?? '', dob, birthYear: dob ? Number(dob.slice(0, 4)) : null, gender, mobile: playerMobile, email: (raw.playerEmail ?? '').toLowerCase() },
      eagles,
      team: raw.team ?? '',
      goalkeeper,
      rfa,
      registration,
      paidBefore,
      number,
      sizes: { shirt: raw.shirtSize ?? '', shorts: raw.shortsSize ?? '', jacket: raw.jacketSize ?? '' },
      emergency: { name: raw.emergencyName ?? '', mobile: emMobile ?? (raw.emergencyMobile || null) },
      medical: raw.medical ?? '',
      photoConsent: photo === 'bad' ? null : photo,
      notes: raw.notes ?? '',
      errors,
      warnings,
      info,
    })
  })
  return { rows: out, missing }
}

export const playerKey = (r: Pick<ImportRow, 'player'>) => `${r.player.first.trim().toLowerCase()}|${r.player.last.trim().toLowerCase()}|${r.player.dob}`

/** What the server knows about the portal, for the checks that need it. */
export type ImportContext = {
  today: string // YYYY-MM-DD
  /** Club team names (any case) → exact name */
  teams: Map<string, string>
  /** Active shirt numbers already in the portal: `${birthYear}-${number}` → the player's key (name|name|dob) */
  numbers: Map<string, string>
  /** Accounts by email → the name on the account */
  accounts: Map<string, string>
  /** That birth year's normal range, if any */
  range: (birthYear: number) => { start: number; end: number } | null
  /** The oldest birth year with a current age group (older players are flagged) */
  oldestBirthYear: number | null
  /** Size options per kit item, when that item exists on the fitout screen */
  sizes: { shirt?: string[]; shorts?: string[]; jacket?: string[] }
}

/** Every check that needs the whole file or the portal. Adds errors/warnings to the rows (and returns them). */
export function checkRows(rows: ImportRow[], ctx: ImportContext) {
  const byKey = new Map<string, ImportRow[]>()
  const byNumber = new Map<string, ImportRow[]>()
  const namesByEmail = new Map<string, Set<string>>()
  for (const r of rows) {
    if (r.player.dob) byKey.set(playerKey(r), [...(byKey.get(playerKey(r)) ?? []), r])
    if (r.player.birthYear && r.number) byNumber.set(`${r.player.birthYear}-${r.number}`, [...(byNumber.get(`${r.player.birthYear}-${r.number}`) ?? []), r])
    if (r.parent1.email) namesByEmail.set(r.parent1.email, new Set([...(namesByEmail.get(r.parent1.email) ?? []), `${r.parent1.first} ${r.parent1.last}`.trim().toLowerCase()]))
  }
  for (const r of rows) {
    if (r.player.dob && r.player.dob > ctx.today) r.errors.push('Date of birth is in the future')
    if (r.player.dob && (byKey.get(playerKey(r))?.length ?? 0) > 1) r.errors.push(`Same player appears more than once in the file (lines ${byKey.get(playerKey(r))!.map((x) => x.line).join(', ')})`)
    if (r.eagles) {
      if (!r.team) r.errors.push('Eagles player with no Eagles team')
      else if (!ctx.teams.has(r.team.trim().toLowerCase())) r.errors.push(`Eagles team “${r.team}” doesn’t exist in the portal`)
    }
    // #1 is the shared goalkeeper top, not anyone's own number — no clash check, nothing saved
    if (r.number === 1 && r.goalkeeper) r.info.push('Goalkeeper — wears the #1 goalkeeper top')
    if (r.player.birthYear && r.number && r.number !== 1) {
      const k = `${r.player.birthYear}-${r.number}`
      const dup = byNumber.get(k) ?? []
      if (dup.length > 1) r.errors.push(`#${r.number} is used by another ${r.player.birthYear} player in the file (lines ${dup.map((x) => x.line).join(', ')})`)
      const holder = ctx.numbers.get(k)
      if (holder && holder !== playerKey(r)) r.errors.push(`#${r.number} is already worn by another ${r.player.birthYear} player in the portal`)
      const range = ctx.range(r.player.birthYear)
      if (range && (r.number < range.start || r.number > range.end)) r.warnings.push(`Keeping existing number outside the ${r.player.birthYear} range (${range.start}–${range.end})`)
    }
    if (r.player.birthYear && ctx.oldestBirthYear && r.player.birthYear < ctx.oldestBirthYear) r.warnings.push('Player is older than the oldest current age group')
    const onFile = ctx.accounts.get(r.parent1.email)
    if (onFile !== undefined && onFile && onFile.toLowerCase() !== `${r.parent1.first} ${r.parent1.last}`.trim().toLowerCase()) r.warnings.push(`Parent 1 email already has an account under a different name (${onFile})`)
    if ((namesByEmail.get(r.parent1.email)?.size ?? 0) > 1) r.warnings.push('This email is used by two different Parent 1 names in the file')
    for (const [k, label] of [['shirt', 'Shirt'], ['shorts', 'Shorts'], ['jacket', 'Jacket']] as const) {
      const v = r.sizes[k]
      const opts = ctx.sizes[k]
      if (v && opts?.length && !opts.some((o) => o.toLowerCase() === v.toLowerCase())) r.warnings.push(`${label} size “${v}” isn’t one of the fitout sizes — not saved`)
    }
  }
  return rows
}

export const rowStatus = (r: Pick<ImportRow, 'errors' | 'warnings'>) => (r.errors.length ? 'error' : r.warnings.length ? 'warning' : 'ok')

/** "Liam", "Liam and Mia", "Liam, Mia and Ava" */
export function namesList(names: string[]) {
  const n = names.filter(Boolean)
  if (n.length <= 1) return n[0] ?? ''
  return `${n.slice(0, -1).join(', ')} and ${n.at(-1)}`
}
