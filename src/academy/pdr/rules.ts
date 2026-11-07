import type { Criteria } from './content'
import type { StageStatus, Tier } from './report'

/**
 * Foundation+ submission rules (pure — unit tested).
 *  - Challenge attempts: any open stage, including ones already passed (to record a better score).
 *  - One attempt waiting for review per stage at a time.
 *  - Feedback-only videos: Premium, limited per calendar month.
 */
export type SubmissionType = 'verification' | 'feedback'

export function canSubmit(o: {
  type: SubmissionType
  status: StageStatus
  tier: Tier
  pendingOnStage: number
  feedbackThisMonth: number
  feedbackPerMonth: number
}): { ok: true } | { ok: false; reason: string } {
  if (o.status === 'coming_soon') return { ok: false, reason: 'This stage isn’t ready yet.' }
  if (o.status === 'locked') return { ok: false, reason: 'This stage is locked.' }
  if (o.pendingOnStage > 0) return { ok: false, reason: 'There’s already a video waiting for a coach on this stage — you can send another once it’s reviewed.' }
  if (o.type === 'feedback') {
    if (o.tier !== 'premium') return { ok: false, reason: 'Feedback videos are part of Premium.' }
    if (o.feedbackThisMonth >= o.feedbackPerMonth) return { ok: false, reason: `You’ve used this month’s ${o.feedbackPerMonth} feedback videos.` }
  }
  return { ok: true }
}

/** Has the score reached the stage's target? */
export function meetsTarget(score: number | null | undefined, c: Criteria | null | undefined) {
  if (score == null || !c?.target) return false
  return c.direction === 'lower' ? score <= c.target : score >= c.target
}

/** Is `a` a better score than `b` for this stage? */
export const isBetter = (a: number, b: number | null | undefined, direction: Criteria['direction']) => b == null || (direction === 'lower' ? a < b : a > b)

/** Start of the calendar month (Sydney) for the feedback allowance. */
export function monthStart(now: Date) {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit' }).format(now) // 2026-11
  return `${ymd}-01`
}
