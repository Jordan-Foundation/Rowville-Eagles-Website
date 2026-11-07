import { PLANS, type PlanKey } from './plans'

/**
 * Foundation+ dashboard numbers (pure — unit tested).
 * Monthly revenue is an estimate: yearly plans count as 1/12 a month, and the family's 2nd and later
 * paying players get the sibling discount, the same way checkout applies it.
 */
export type MemberRow = { id: number; account: number | null; plan: string | null; status: string | null; cancelAtPeriodEnd?: boolean | null }
export type EventRow = { type: string; createdAt: string }

const PAYING = new Set(['active', 'past_due'])
const LIVE = new Set(['active', 'past_due', 'trialing'])

export function memberStats(rows: MemberRow[], prices: Record<PlanKey, number>, siblingPct: number) {
  const byPlan = Object.fromEntries(PLANS.map((p) => [p.key, { paying: 0, trialing: 0 }])) as Record<PlanKey, { paying: number; trialing: number }>
  let trialing = 0, paying = 0, pastDue = 0, cancelling = 0, mrr = 0
  const live = rows.filter((r) => r.status && LIVE.has(r.status) && PLANS.some((p) => p.key === r.plan)).sort((a, b) => a.id - b.id)
  const seenAccounts = new Map<number, number>()
  for (const r of live) {
    const plan = PLANS.find((p) => p.key === r.plan)!
    const nth = r.account == null ? 0 : (seenAccounts.get(r.account) ?? 0)
    if (r.account != null) seenAccounts.set(r.account, nth + 1)
    if (r.cancelAtPeriodEnd) cancelling++
    if (r.status === 'trialing') { trialing++; byPlan[plan.key].trialing++; continue }
    if (!PAYING.has(r.status!)) continue
    paying++; byPlan[plan.key].paying++
    if (r.status === 'past_due') pastDue++
    const monthly = plan.interval === 'year' ? prices[plan.key] / 12 : prices[plan.key]
    mrr += nth > 0 ? monthly * (1 - siblingPct / 100) : monthly
  }
  return { byPlan, trialing, paying, pastDue, cancelling, mrr: Math.round(mrr * 100) / 100 }
}

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`

/** Last `months` calendar months (oldest first), counting trials, conversions and cancellations. */
export function monthlyActivity(events: EventRow[], months = 6, now = new Date()) {
  const keys: string[] = []
  for (let i = months - 1; i >= 0; i--) keys.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))))
  const rows = keys.map((month) => ({ month, trialsStarted: 0, converted: 0, trialEndedUnpaid: 0, newPaid: 0, cancelled: 0 }))
  for (const e of events) {
    const row = rows.find((r) => r.month === monthKey(new Date(e.createdAt)))
    if (!row) continue
    if (e.type === 'trial_started') row.trialsStarted++
    else if (e.type === 'trial_converted') row.converted++
    else if (e.type === 'trial_cancelled') row.trialEndedUnpaid++
    else if (e.type === 'subscribed' || e.type === 'reactivated') row.newPaid++
    else if (e.type === 'cancelled' || e.type === 'grace_expired') row.cancelled++
  }
  return rows
}

/** Of the free months that have finished, how many turned into a paid plan (null until one has finished). */
export function conversionRate(events: EventRow[]) {
  const converted = events.filter((e) => e.type === 'trial_converted').length
  const ended = converted + events.filter((e) => e.type === 'trial_cancelled').length
  return ended ? { pct: Math.round((converted / ended) * 100), converted, ended } : null
}
