/**
 * When Academy term registrations open (pure — unit tested).
 * Term 1 opens at the time Management chooses in Yearly setup; each later term opens when the
 * term before it has 2 weeks left (at the start of that day, Sydney). Management can change any
 * opening time, turn automatic opening off, or open/close a program by hand.
 */
import { localToUtc } from '../lib/time'

export const OPEN_DAYS_BEFORE_END = 14

const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Opening time for term n (1–4): Term 1 = the chosen time (or now); later terms = 14 days before the previous term ends. */
export function opensAtFor(n: number, termEnds: string[], term1OpensAt: string | null | undefined, now = new Date()): string {
  if (n <= 1) return term1OpensAt || now.toISOString()
  const prevEnd = termEnds[n - 2]
  return localToUtc(addDays(prevEnd, -OPEN_DAYS_BEFORE_END), '00:00').toISOString()
}

type Releasable = { status?: string | null; autoOpen?: boolean | null; opensAt?: string | null }
/** A draft program whose opening time has come (and automatic opening is on). */
export const dueToOpen = (p: Releasable, now: Date) => p.status === 'draft' && p.autoOpen !== false && !!p.opensAt && new Date(p.opensAt).getTime() <= now.getTime()

/** "Opens Mon 29 Mar, 12:00 am" style label, or why it won't open by itself. */
export function releaseLabel(p: Releasable, now: Date, fmt: (iso: string) => string) {
  if (p.status === 'open' || p.status === 'full') return 'Open for registrations'
  if (p.status === 'closed') return 'Closed'
  if (!p.opensAt) return 'Opens when you open it'
  if (p.autoOpen === false) return `Automatic opening off (was ${fmt(p.opensAt)})`
  return new Date(p.opensAt).getTime() <= now.getTime() ? 'Opening now' : `Opens ${fmt(p.opensAt)}`
}

