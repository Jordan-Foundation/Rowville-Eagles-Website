/** Management → Foundation+ (pure — unit tested). */
import { GRACE_DAYS } from './billing/plans'
import { daysLeft, monthKey } from './challenge-rules'

const DAY = 86_400_000

/** Whole days a past-due player keeps access before the daily sweep drops them to Free (0 = today). */
export function graceDaysLeft(pastDueSince: string | null | undefined, now = new Date()) {
  if (!pastDueSince) return GRACE_DAYS
  const used = Math.floor((now.getTime() - Date.parse(pastDueSince)) / DAY)
  return Math.max(0, GRACE_DAYS - used)
}

/** "2027-04" for the month after `now` (Melbourne). */
export function nextMonthKey(now = new Date()) {
  const [y, m] = monthKey(now).split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

/** Days before Management is nagged to set up next month's challenge. */
export const CHALLENGE_SETUP_DAYS = 14

/** Next month's challenge still needs setting up (and it's close enough to matter): missing, or not live. */
export function challengeSetupNeeded(challenges: { month: string; published?: boolean | null }[], now = new Date()) {
  const next = nextMonthKey(now)
  const ch = challenges.find((c) => c.month === next)
  const soon = daysLeft(monthKey(now), now) <= CHALLENGE_SETUP_DAYS
  if (!soon) return null
  if (!ch) return { month: next, reason: 'missing' as const }
  if (!ch.published) return { month: next, reason: 'draft' as const }
  return null
}

/** Don't let a reminder be sent more than once a day. */
export const canRemind = (lastAt: string | null | undefined, now = new Date()) => !lastAt || now.getTime() - Date.parse(lastAt) >= DAY
