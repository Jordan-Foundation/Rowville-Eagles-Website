import { describe, expect, it } from 'vitest'
import { lifecycleEvent, lookupKey, planFromLookup, planOf, siblingDiscountApplies, subscriptionEffect } from '@/academy/pdr/billing/plans'

describe('Foundation+ plans', () => {
  it('maps plans to Stripe lookup keys and back', () => {
    expect(lookupKey('premium_month')).toBe('fplus_premium_month')
    expect(planFromLookup('fplus_standard_year')?.tier).toBe('standard')
    expect(planOf('premium', 'year')?.key).toBe('premium_year')
    expect(planOf('premium', undefined)?.key).toBe('premium_month')
  })
  it('active and trialling players get their tier and the Foundation+ tag', () => {
    expect(subscriptionEffect({ status: 'active', plan: 'standard_month' })).toEqual({ tier: 'standard', tagged: true, inGrace: false })
    expect(subscriptionEffect({ status: 'trialing', plan: 'premium_month' })).toMatchObject({ tier: 'premium', tagged: true })
  })
  it('failed payments keep access for 7 days, then drop to Free', () => {
    const now = new Date('2026-12-10T00:00:00Z')
    expect(subscriptionEffect({ status: 'past_due', plan: 'premium_month', pastDueSince: '2026-12-05T00:00:00Z', now })).toEqual({ tier: 'premium', tagged: true, inGrace: true })
    expect(subscriptionEffect({ status: 'past_due', plan: 'premium_month', pastDueSince: '2026-12-02T00:00:00Z', now })).toEqual({ tier: 'free', tagged: false, inGrace: false })
  })
  it('cancelled or never-paid subscriptions are Free', () => {
    for (const status of ['canceled', 'incomplete', 'incomplete_expired', 'paused']) expect(subscriptionEffect({ status, plan: 'premium_year' })).toMatchObject({ tier: 'free', tagged: false })
  })
  it('sibling discount only when another player is already on a plan', () => {
    expect(siblingDiscountApplies(0, 25)).toBe(false)
    expect(siblingDiscountApplies(1, 25)).toBe(true)
    expect(siblingDiscountApplies(2, 0)).toBe(false)
  })
  it('names lifecycle events for the dashboard', () => {
    expect(lifecycleEvent(null, { status: 'trialing', plan: 'premium_month' })).toBe('trial_started')
    expect(lifecycleEvent({ status: 'trialing' }, { status: 'active', plan: 'premium_month' })).toBe('trial_converted')
    expect(lifecycleEvent({ status: 'trialing' }, { status: 'canceled', plan: 'premium_month' })).toBe('trial_cancelled')
    expect(lifecycleEvent(null, { status: 'active', plan: 'standard_month' })).toBe('subscribed')
    expect(lifecycleEvent({ status: 'active' }, { status: 'past_due', plan: 'standard_month' })).toBe('payment_failed')
    expect(lifecycleEvent({ status: 'past_due' }, { status: 'active', plan: 'standard_month' })).toBe('payment_recovered')
    expect(lifecycleEvent({ status: 'active', plan: 'standard_month' }, { status: 'active', plan: 'premium_month' })).toBe('plan_changed')
    expect(lifecycleEvent({ status: 'active' }, { status: 'canceled', plan: 'standard_month' })).toBe('cancelled')
    expect(lifecycleEvent({ status: 'active', plan: 'standard_month' }, { status: 'active', plan: 'standard_month' })).toBeNull()
  })
})
