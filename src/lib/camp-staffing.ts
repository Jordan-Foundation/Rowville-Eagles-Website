/**
 * Holiday camp coach staffing rules (pure — unit tested).
 */
import { localToUtc } from './time'

export const STAFFING_DEFAULTS = { coachesPerGroup: 1, extraCoaches: 1, confirmReminderHours: 24, escalateHours: 48 } as const

/** Coaches needed: enough for the busiest day's groups, plus the extra coaches. No children → none. */
export function coachesNeeded(o: { maxGroups: number; perGroup: number; extra: number }) {
  if (o.maxGroups <= 0) return 0
  return o.maxGroups * Math.max(0, o.perGroup) + Math.max(0, o.extra)
}

/** How a camp's staffing stands: still short (counting coaches who haven't answered), or more than needed. */
export function staffingGap(o: { needed: number; confirmed: number; invited: number }) {
  const lined = o.confirmed + o.invited
  return {
    /** Coaches still to ask */
    short: Math.max(0, o.needed - lined),
    /** Confirmed coaches beyond what's needed (never removed automatically) */
    over: Math.max(0, o.confirmed - o.needed),
    /** Waiting on answers */
    waiting: o.invited,
  }
}

const H = 3_600_000
/** Reminder once, this many hours after the invite (if they haven't answered). */
export const reminderDue = (o: { invitedAt: string; remindedAt?: string | null; now: Date; hours: number }) =>
  !o.remindedAt && o.now.getTime() - new Date(o.invitedAt).getTime() >= o.hours * H
/** Tell Management once, this many hours after the invite. */
export const escalationDue = (o: { invitedAt: string; escalatedAt?: string | null; now: Date; hours: number }) =>
  !o.escalatedAt && o.now.getTime() - new Date(o.invitedAt).getTime() >= o.hours * H

export type Range = { from: string; to: string }
export const overlaps = (a: Range, b: Range) => new Date(a.from) < new Date(b.to) && new Date(b.from) < new Date(a.to)

/** Each camp day as a time range (Sydney). */
export const campDayRanges = (days: { date: string; start: string; end: string }[]): (Range & { date: string })[] =>
  days.map((d) => ({ date: d.date, from: localToUtc(d.date, d.start).toISOString(), to: localToUtc(d.date, d.end).toISOString() }))

/**
 * Bookable start times a coach can't take because of their blocks (e.g. a confirmed camp day):
 * any session that would overlap the block. `timesFor(ymd)` lists the possible start times that day.
 */
export function blockedStarts(blocks: (Range & { coachId: number })[], timesFor: (ymd: string) => string[], minutes: number): { coachId: number; startsAt: string }[] {
  const out: { coachId: number; startsAt: string }[] = []
  for (const b of blocks) {
    const from = new Date(b.from).getTime()
    const to = new Date(b.to).getTime()
    // Sydney dates the block touches (a day either side covers time-zone edges)
    const first = new Date(from - 86_400_000)
    for (let d = first; d.getTime() <= to + 86_400_000; d = new Date(d.getTime() + 86_400_000)) {
      const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
      for (const t of timesFor(ymd)) {
        const s = localToUtc(ymd, t).getTime()
        if (s < to && s + minutes * 60_000 > from) out.push({ coachId: b.coachId, startsAt: new Date(s).toISOString() })
      }
    }
  }
  const seen = new Set<string>()
  return out.filter((x) => { const k = `${x.coachId}|${x.startsAt}`; if (seen.has(k)) return false; seen.add(k); return true })
}
