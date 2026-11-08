import { createHash, randomBytes } from 'crypto'

/**
 * Coach share links (pure — unit tested).
 *  - Hold: 0–72 hours (0 = just a link, nothing reserved). Never past the session's booking cut-off.
 *  - The link keeps working after the hold ends, as long as the time is still free — for up to 14 days.
 */
export const MAX_HOLD_HOURS = 72
export const LINK_DAYS = 14
export const HOLD_CHOICES = [0, 2, 4, 12, 24, 48, 72]

export const newShareToken = () => randomBytes(24).toString('base64url')
export const hashShareToken = (t: string) => createHash('sha256').update(t).digest('hex')
export const validShareToken = (t: string) => /^[A-Za-z0-9_-]{32}$/.test(t)

/** How long to hold, capped so the family can still book before the booking cut-off for the first session. */
export function holdUntil(o: { hours: number; now: Date; firstSessionAt: string; cutoffHours: number }) {
  const hours = Math.max(0, Math.min(MAX_HOLD_HOURS, Math.floor(o.hours)))
  if (!hours) return null
  const latest = new Date(o.firstSessionAt).getTime() - o.cutoffHours * 3_600_000
  const until = Math.min(o.now.getTime() + hours * 3_600_000, latest)
  return until > o.now.getTime() + 30 * 60_000 ? new Date(until) : null
}

export function linkExpiry(o: { now: Date; firstSessionAt: string; cutoffHours: number }) {
  const latest = new Date(o.firstSessionAt).getTime() - o.cutoffHours * 3_600_000
  return new Date(Math.min(o.now.getTime() + LINK_DAYS * 86_400_000, latest))
}

export type LinkState = 'held' | 'open' | 'booked' | 'cancelled' | 'expired'

export function linkState(l: { status: string; holdUntil?: string | null; expiresAt?: string | null; holdActive?: boolean }, now = new Date()): LinkState {
  if (l.status === 'booked') return 'booked'
  if (l.status === 'cancelled') return 'cancelled'
  if (l.expiresAt && new Date(l.expiresAt) <= now) return 'expired'
  if (l.holdActive && l.holdUntil && new Date(l.holdUntil) > now) return 'held'
  return 'open'
}
