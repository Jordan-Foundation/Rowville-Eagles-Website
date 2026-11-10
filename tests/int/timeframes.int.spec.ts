import { describe, expect, it } from 'vitest'
import { allowsWeekly, categoryOfPeriod, isHolidayTimeframe, periodFromName, timeframeNoun } from '../../src/academy/timeframes'

describe('Timeframes', () => {
  it('works out the period from the name', () => {
    expect(periodFromName('Term 2 2027')).toBe('term-2')
    expect(periodFromName('T4 2026')).toBe('term-4')
    expect(periodFromName('Summer holidays 2026/27')).toBe('summer')
    expect(periodFromName('Christmas break')).toBe('summer')
    expect(periodFromName('April school holidays 2027')).toBe('april')
    expect(periodFromName('Mid-year holidays')).toBe('mid-year')
    expect(periodFromName('September holidays 2027')).toBe('september')
    expect(periodFromName('Something else')).toBeNull()
    expect(periodFromName('Term 5')).toBeNull()
  })
  it('category follows the period', () => {
    expect(categoryOfPeriod('term-3')).toBe('school-term')
    expect(categoryOfPeriod('april')).toBe('school-holidays')
    expect(categoryOfPeriod(null)).toBeNull()
  })
  it('older timeframes with no category are school terms; weekly bookings only in terms', () => {
    expect(isHolidayTimeframe({})).toBe(false)
    expect(allowsWeekly({ category: null })).toBe(true)
    expect(allowsWeekly({ category: 'school-holidays' })).toBe(false)
    expect(timeframeNoun({ category: 'school-holidays' })).toBe('holidays')
    expect(timeframeNoun({ category: 'school-term' })).toBe('term')
  })
})
