/**
 * Finance — pure rules (no database), unit-tested in tests/int/finance.int.spec.ts.
 * All dates are local (Australia/Melbourne = the app's time zone, same rules as Sydney); money in AUD.
 */

export const r2 = (n: number) => Math.round(n * 100) / 100
const MIN = 60_000

// ── Rates ──────────────────────────────────────────────────────────────────────

export type Rate = { hourlyRate: number; effectiveFrom: string }

/** The rate that applied on a date: the latest one whose effective date is on or before it. */
export function rateOn(rates: Rate[], dateYmd: string): number | null {
  const ok = rates.filter((r) => r.effectiveFrom.slice(0, 10) <= dateYmd).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
  return ok[0]?.hourlyRate ?? null
}

// ── Hour lines ─────────────────────────────────────────────────────────────────

export type LineKind = 'one-on-one' | 'small-group' | 'academy' | 'mini-ballers' | 'camp' | 'eagles-training' | 'eagles-game' | 'manual' | 'paid-cancellation' | 'setup_packup'
export const KIND_LABEL: Record<LineKind, string> = {
  'one-on-one': '1-on-1',
  'small-group': 'Small group',
  academy: 'Academy training',
  'mini-ballers': 'Mini Ballers',
  camp: 'Holiday camp',
  'eagles-training': 'Eagles training',
  'eagles-game': 'Eagles game',
  manual: 'Manual hours',
  'paid-cancellation': 'Cancelled (paid)',
  setup_packup: 'Setup & pack-up',
}
/** Coached session kinds (setup/pack-up applies to these by default). */
export const COACHED_KINDS: LineKind[] = ['one-on-one', 'small-group', 'academy', 'mini-ballers', 'camp', 'eagles-training', 'eagles-game']

export type HourLine = {
  key: string
  coachId: number
  date: string // local YYYY-MM-DD
  startsAt: string // ISO
  endsAt: string // ISO
  minutes: number
  kind: LineKind
  venue?: string | null
  client?: string | null
  shareLink?: boolean
  /** What the customer paid for this one session (share-link bonus base). */
  customerAmount?: number | null
  note?: string | null
  blockId?: string
}

const venueKey = (v?: string | null) => (v ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

export type BlockSettings = { setupMinutes: number; packupMinutes: number; gapMinutes: number; kinds: LineKind[] }
export const DEFAULT_BLOCKS: BlockSettings = { setupMinutes: 15, packupMinutes: 15, gapMinutes: 0, kinds: COACHED_KINDS }

/**
 * Groups each coach's sessions into blocks (same day, same venue, each starting within `gapMinutes` of the last one
 * ending) and adds one setup/pack-up line per block. Returns the sessions (with blockId) plus the new lines.
 */
export function withSetupPackup(lines: HourLine[], s: BlockSettings = DEFAULT_BLOCKS): HourLine[] {
  const eligible = lines.filter((l) => s.kinds.includes(l.kind)).sort((a, b) => a.coachId - b.coachId || a.startsAt.localeCompare(b.startsAt))
  const others = lines.filter((l) => !s.kinds.includes(l.kind))
  const out: HourLine[] = []
  const extra = s.setupMinutes + s.packupMinutes
  let block: HourLine[] = []
  const close = () => {
    if (!block.length) return
    const first = block[0]
    const last = block.reduce((m, l) => (l.endsAt > m.endsAt ? l : m), block[0])
    const id = `blk:${first.coachId}:${first.startsAt}`
    for (const l of block) out.push({ ...l, blockId: id })
    if (extra > 0) {
      out.push({
        key: `${id}:setup`,
        coachId: first.coachId,
        date: first.date,
        startsAt: new Date(Date.parse(first.startsAt) - s.setupMinutes * MIN).toISOString(),
        endsAt: new Date(Date.parse(last.endsAt) + s.packupMinutes * MIN).toISOString(),
        minutes: extra,
        kind: 'setup_packup',
        venue: first.venue,
        note: `${s.setupMinutes} min before + ${s.packupMinutes} min after${block.length > 1 ? ` (${block.length} back-to-back sessions)` : ''}`,
        blockId: id,
      })
    }
    block = []
  }
  for (const l of eligible) {
    const prev = block.at(-1)
    const joins = prev && prev.coachId === l.coachId && prev.date === l.date && venueKey(prev.venue) === venueKey(l.venue) && Date.parse(l.startsAt) - Math.max(...block.map((b) => Date.parse(b.endsAt))) <= s.gapMinutes * MIN && Date.parse(l.startsAt) >= Date.parse(prev.startsAt)
    if (!joins) close()
    block.push(l)
  }
  close()
  return [...out, ...others].sort((a, b) => a.coachId - b.coachId || a.startsAt.localeCompare(b.startsAt) || (a.kind === 'setup_packup' ? -1 : 1))
}

// ── Share-link bonus & super ─────────────────────────────────────────────────────

/** A package or term paid as one amount, spread evenly over its sessions. */
export const perSession = (paid: number, sessions: number) => r2(paid / Math.max(1, sessions))

export const bonusFor = (l: Pick<HourLine, 'shareLink' | 'customerAmount' | 'kind'>, pct: number) =>
  l.shareLink && l.kind !== 'setup_packup' && (l.customerAmount ?? 0) > 0 ? r2(((l.customerAmount ?? 0) * pct) / 100) : 0

export type PaySettings = { superRate: number; superOnBonus: boolean; bonusPct: number }
export const DEFAULT_PAY: PaySettings = { superRate: 12, superOnBonus: true, bonusPct: 10 }

export type CoachPay = {
  coachId: number
  minutes: number
  hours: number
  base: number
  bonus: number
  bonusReversed: number
  gross: number
  super: number
  total: number
  missingRate: boolean
}

/**
 * One coach's week: base = each line's hours × the rate on its date; bonus = share-link lines; super on top of
 * wages (and the bonus when `superOnBonus`). `reversals` are bonuses paid earlier that must come back off.
 */
export function payForCoach(coachId: number, lines: HourLine[], rates: Rate[], s: PaySettings, o: { superOn?: boolean; reversals?: number } = {}): CoachPay {
  let minutes = 0
  let base = 0
  let bonus = 0
  let missingRate = false
  for (const l of lines) {
    minutes += l.minutes
    const rate = rateOn(rates, l.date)
    if (rate == null) missingRate = true
    base += ((rate ?? 0) * l.minutes) / 60
    bonus += bonusFor(l, s.bonusPct)
  }
  const bonusReversed = r2(o.reversals ?? 0)
  const netBonus = r2(bonus - bonusReversed)
  const gross = r2(base + netBonus)
  const superBase = r2(base) + (s.superOnBonus ? netBonus : 0)
  const sup = o.superOn === false ? 0 : r2((Math.max(0, superBase) * s.superRate) / 100)
  return { coachId, minutes, hours: r2(minutes / 60), base: r2(base), bonus: r2(bonus), bonusReversed, gross, super: sup, total: r2(gross + sup), missingRate }
}

// ── Weeks (Monday–Sunday, local) ─────────────────────────────────────────────────

/** Monday (YYYY-MM-DD) of the week a local date falls in. */
export function mondayOf(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}
export const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
/** The week before the one containing `todayYmd` (what Monday's report covers). */
export const previousWeek = (todayYmd: string) => {
  const start = addDays(mondayOf(todayYmd), -7)
  return { start, end: addDays(start, 6) }
}
/** Is the Monday report due? weekday 0=Sun…6=Sat, hour 0–23 local. */
export const reportDue = (local: { weekday: number; hour: number }, setting: { day: number; hour: number }) => local.weekday === setting.day && local.hour >= setting.hour

/** Coaching cost as a % of revenue (null when there was no revenue). */
export const pctOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null)
