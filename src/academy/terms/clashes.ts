import { formatDate } from '../../lib/format'
import { toYmd } from '../term-dates'
import type { GroupSession } from './slots'

/** Something else a coach is doing at a given time. */
export type Busy = { label: string; startsAt: string; endsAt: string }

const overlap = (a: { startsAt: string; endsAt: string }, b: { startsAt: string; endsAt: string }) =>
  new Date(a.startsAt) < new Date(b.endsAt) && new Date(b.startsAt) < new Date(a.endsAt)

const day = (iso: string) => formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short' })

/**
 * Warnings for putting a coach on a training time: they're coaching another time that overlaps,
 * have a 1-on-1 booked at the same time, or are away on some of the dates. Only future sessions count.
 */
export function coachClashes(o: { coach: string; sessions: GroupSession[]; busy: Busy[]; away: { from: string; to: string; note?: string | null }[]; now?: Date }): string[] {
  const now = o.now ?? new Date()
  const sessions = o.sessions.filter((s) => !s.cancelled && new Date(s.endsAt) > now)
  const out: string[] = []
  const byLabel = new Map<string, string[]>()
  for (const s of sessions) {
    for (const b of o.busy) if (overlap(s, b)) byLabel.set(b.label, [...(byLabel.get(b.label) ?? []), day(s.startsAt)])
  }
  for (const [label, days] of byLabel) {
    const uniq = [...new Set(days)]
    out.push(`${o.coach} also has ${label} at the same time on ${uniq.length > 3 ? `${uniq.length} dates (from ${uniq[0]})` : uniq.join(', ')}`)
  }
  const awayDays = sessions.filter((s) => o.away.some((a) => s.date >= toYmd(a.from) && s.date <= toYmd(a.to))).map((s) => day(s.startsAt))
  if (awayDays.length) out.push(`${o.coach} is away on ${awayDays.length > 3 ? `${awayDays.length} session dates (from ${awayDays[0]})` : awayDays.join(', ')}`)
  return out
}
