import { describe, expect, it } from 'vitest'
import { coachCapacity, utilisation } from '@/academy/dashboard'

const term = { startDate: '2027-01-31T13:00:00.000Z', endDate: '2027-04-01T12:59:00.000Z' } // 1 Feb – 1 Apr

describe('dashboard capacity', () => {
  it('counts every weekly time across the term', () => {
    expect(coachCapacity(term, { coachId: 1, slots: [{ weekday: 'Tuesday', startTime: '17:00' }, { weekday: 'Saturday', startTime: '09:00' }], away: [] })).toBe(9 + 8)
  })
  it('leaves out away weeks', () => {
    expect(coachCapacity(term, { coachId: 1, slots: [{ weekday: 'Tuesday', startTime: '17:00' }], away: [{ from: '2027-02-28T13:00:00Z', to: '2027-03-07T12:59:00Z' }] })).toBe(8)
  })
  it('works out utilisation', () => {
    expect(utilisation(9, 17)).toBe(53)
    expect(utilisation(3, 0)).toBe(0)
    expect(utilisation(20, 17)).toBe(100)
  })
})
