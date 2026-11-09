import type { AcademySetting } from '@/payload-types'

export const GROUP_MIN = 2
export const GROUP_MAX = 5

export type GroupSettings = {
  casual2: number
  casual3: number
  casual4: number
  casual5: number
  termDiscountPct: number
  inviteDeadlineHours: number
  reminderHoursBefore: number
}

export const GROUP_DEFAULTS: GroupSettings = { casual2: 70, casual3: 60, casual4: 50, casual5: 40, termDiscountPct: 10, inviteDeadlineHours: 48, reminderHoursBefore: 12 }

/** The group settings with defaults filled in (older databases may have empty values). */
export function groupSettings(s?: Pick<AcademySetting, 'groupSessions'> | null): GroupSettings {
  const g = (s?.groupSessions ?? {}) as Partial<Record<keyof GroupSettings, number | null>>
  const out = { ...GROUP_DEFAULTS }
  for (const k of Object.keys(GROUP_DEFAULTS) as (keyof GroupSettings)[]) {
    const v = g[k]
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v
  }
  return out
}

/** Round to whole cents. */
const cents = (n: number) => Math.round(n * 100) / 100

/**
 * Price per player, per session (pure). Casual groups pay the casual rate for their size; term groups
 * pay that less the term discount. Sizes outside 2–5 have no group price.
 */
export function groupRate(settings: GroupSettings, size: number, type: 'casual' | 'term'): number {
  if (!Number.isInteger(size) || size < GROUP_MIN || size > GROUP_MAX) throw new Error(`A small group is ${GROUP_MIN}–${GROUP_MAX} players.`)
  const casual = settings[`casual${size}` as 'casual2']
  if (type === 'casual') return cents(casual)
  const pct = Math.min(100, Math.max(0, settings.termDiscountPct))
  return cents(casual * (1 - pct / 100))
}

/** What one player pays, and what the whole group brings in, for a number of sessions. */
export function groupQuote(settings: GroupSettings, size: number, type: 'casual' | 'term', sessions: number) {
  const rate = groupRate(settings, size, type)
  return { rate, sessions, perPlayer: cents(rate * sessions), perSession: cents(rate * size), total: cents(rate * size * sessions) }
}
