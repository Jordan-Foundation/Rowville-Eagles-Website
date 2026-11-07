import { describe, expect, it } from 'vitest'
import { conversionRate, memberStats, monthlyActivity } from '@/academy/pdr/billing/stats'

const prices = { standard_month: 10, standard_year: 120, premium_month: 25, premium_year: 240 }

describe('Foundation+ dashboard numbers', () => {
  it('counts members by plan and estimates monthly revenue with the sibling discount', () => {
    const s = memberStats(
      [
        { id: 1, account: 1, plan: 'premium_month', status: 'active' },
        { id: 2, account: 1, plan: 'standard_month', status: 'active' }, // sibling: 25% off → 7.50
        { id: 3, account: 2, plan: 'standard_year', status: 'past_due' }, // 10/month, still in grace
        { id: 4, account: 3, plan: 'premium_month', status: 'trialing', cancelAtPeriodEnd: true },
        { id: 5, account: 4, plan: 'premium_month', status: 'canceled' },
        { id: 6, account: 5, plan: null, status: null },
      ],
      prices,
      25,
    )
    expect(s).toMatchObject({ paying: 3, trialing: 1, pastDue: 1, cancelling: 1, mrr: 42.5 })
    expect(s.byPlan.premium_month).toEqual({ paying: 1, trialing: 1 })
  })
  it('groups activity by month and works out trial conversion', () => {
    const ev = [
      { type: 'trial_started', createdAt: '2026-10-03T00:00:00Z' },
      { type: 'trial_started', createdAt: '2026-11-02T00:00:00Z' },
      { type: 'trial_converted', createdAt: '2026-11-03T00:00:00Z' },
      { type: 'trial_cancelled', createdAt: '2026-11-04T00:00:00Z' },
      { type: 'grace_expired', createdAt: '2026-11-05T00:00:00Z' },
      { type: 'trial_started', createdAt: '2025-01-01T00:00:00Z' },
    ]
    const m = monthlyActivity(ev, 3, new Date('2026-11-20T00:00:00Z'))
    expect(m.map((r) => r.month)).toEqual(['2026-09', '2026-10', '2026-11'])
    expect(m[2]).toMatchObject({ trialsStarted: 1, converted: 1, trialEndedUnpaid: 1, cancelled: 1 })
    expect(conversionRate(ev)).toEqual({ pct: 50, converted: 1, ended: 2 })
    expect(conversionRate([])).toBeNull()
  })
})
