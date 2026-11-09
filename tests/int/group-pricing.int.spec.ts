import { describe, expect, it } from 'vitest'
import { GROUP_DEFAULTS, groupQuote, groupRate, groupSettings } from '@/academy/group-pricing'

describe('small group prices', () => {
  it('casual: $70 / $60 / $50 / $40 per player', () => {
    expect([2, 3, 4, 5].map((n) => groupRate(GROUP_DEFAULTS, n, 'casual'))).toEqual([70, 60, 50, 40])
  })
  it('term: 10% off the casual rate', () => {
    expect([2, 3, 4, 5].map((n) => groupRate(GROUP_DEFAULTS, n, 'term'))).toEqual([63, 54, 45, 36])
  })
  it('follows the settings, rounding to cents', () => {
    const s = { ...GROUP_DEFAULTS, casual3: 55, termDiscountPct: 15 }
    expect(groupRate(s, 3, 'casual')).toBe(55)
    expect(groupRate(s, 3, 'term')).toBe(46.75)
    expect(groupRate({ ...GROUP_DEFAULTS, casual4: 33.33, termDiscountPct: 7 }, 4, 'term')).toBe(31)
  })
  it('only 2 to 5 players', () => {
    for (const n of [0, 1, 6, 2.5]) expect(() => groupRate(GROUP_DEFAULTS, n, 'casual')).toThrow()
  })
  it('quote: per player, per session and total', () => {
    expect(groupQuote(GROUP_DEFAULTS, 3, 'term', 8)).toEqual({ rate: 54, sessions: 8, perPlayer: 432, perSession: 162, total: 1296 })
    expect(groupQuote(GROUP_DEFAULTS, 3, 'casual', 1)).toEqual({ rate: 60, sessions: 1, perPlayer: 60, perSession: 180, total: 180 })
  })
  it('fills missing settings with the defaults', () => {
    expect(groupSettings(null)).toEqual(GROUP_DEFAULTS)
    expect(groupSettings({ groupSessions: { casual2: 75, casual3: null } as never })).toEqual({ ...GROUP_DEFAULTS, casual2: 75 })
  })
})
