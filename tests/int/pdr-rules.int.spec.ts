import { describe, expect, it } from 'vitest'
import { canSubmit, isBetter, meetsTarget } from '@/academy/pdr/rules'

const base = { type: 'verification' as const, status: 'not_started' as const, tier: 'free' as const, pendingOnStage: 0, feedbackThisMonth: 0, feedbackPerMonth: 2 }

describe('Foundation+ submissions', () => {
  it('allows attempts on open stages, and on passed stages to beat the score', () => {
    expect(canSubmit(base).ok).toBe(true)
    expect(canSubmit({ ...base, status: 'passed_verified' }).ok).toBe(true)
    expect(canSubmit({ ...base, status: 'passed_promoted' }).ok).toBe(true)
  })
  it('refuses locked or unwritten stages and a second attempt while one is waiting', () => {
    expect(canSubmit({ ...base, status: 'locked' })).toMatchObject({ ok: false })
    expect(canSubmit({ ...base, status: 'coming_soon' })).toMatchObject({ ok: false })
    expect(canSubmit({ ...base, pendingOnStage: 1 })).toMatchObject({ ok: false, reason: expect.stringMatching(/waiting/) })
  })
  it('feedback videos: Premium only, with a monthly allowance', () => {
    expect(canSubmit({ ...base, type: 'feedback', tier: 'standard' })).toMatchObject({ ok: false, reason: expect.stringMatching(/Premium/) })
    expect(canSubmit({ ...base, type: 'feedback', tier: 'premium', feedbackThisMonth: 1 }).ok).toBe(true)
    expect(canSubmit({ ...base, type: 'feedback', tier: 'premium', feedbackThisMonth: 2 })).toMatchObject({ ok: false })
  })
  it('checks targets and better scores in the right direction', () => {
    const passes = { target: 30, unit: 'passes', direction: 'higher' as const }
    const time = { target: 20, unit: 'seconds', direction: 'lower' as const }
    expect(meetsTarget(30, passes)).toBe(true)
    expect(meetsTarget(29, passes)).toBe(false)
    expect(meetsTarget(19.5, time)).toBe(true)
    expect(meetsTarget(21, time)).toBe(false)
    expect(isBetter(33, 31, 'higher')).toBe(true)
    expect(isBetter(18, 17.2, 'lower')).toBe(false)
    expect(isBetter(18, null, 'lower')).toBe(true)
  })
})
