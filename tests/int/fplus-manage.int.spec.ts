import { describe, expect, it } from 'vitest'
import { canRemind, challengeSetupNeeded, graceDaysLeft, nextMonthKey } from '../../src/academy/pdr/manage-rules'

describe('Foundation+ management rules', () => {
  it('grace days left (7-day grace)', () => {
    const now = new Date('2027-03-10T00:00:00Z')
    expect(graceDaysLeft('2027-03-10T00:00:00Z', now)).toBe(7)
    expect(graceDaysLeft('2027-03-07T00:00:00Z', now)).toBe(4)
    expect(graceDaysLeft('2027-02-20T00:00:00Z', now)).toBe(0)
  })
  it('next month in Melbourne, across the year end', () => {
    expect(nextMonthKey(new Date('2027-03-10T00:00:00Z'))).toBe('2027-04')
    expect(nextMonthKey(new Date('2027-12-31T14:00:00Z'))).toBe('2028-02') // already 1 Jan in Melbourne
    expect(nextMonthKey(new Date('2027-12-15T00:00:00Z'))).toBe('2028-01')
  })
  it('asks for next month’s challenge only in the last two weeks', () => {
    const early = new Date('2027-03-05T00:00:00Z')
    const late = new Date('2027-03-20T00:00:00Z')
    expect(challengeSetupNeeded([], early)).toBeNull()
    expect(challengeSetupNeeded([], late)).toEqual({ month: '2027-04', reason: 'missing' })
    expect(challengeSetupNeeded([{ month: '2027-04', published: false }], late)).toEqual({ month: '2027-04', reason: 'draft' })
    expect(challengeSetupNeeded([{ month: '2027-04', published: true }], late)).toBeNull()
  })
  it('one reminder a day', () => {
    const now = new Date('2027-03-10T12:00:00Z')
    expect(canRemind(null, now)).toBe(true)
    expect(canRemind('2027-03-10T01:00:00Z', now)).toBe(false)
    expect(canRemind('2027-03-09T11:00:00Z', now)).toBe(true)
  })
})
