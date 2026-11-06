import { describe, expect, it } from 'vitest'
import { scheduleSummary, slotOccurrences, termDatesForWeekday, termEndDate } from '@/academy/term-dates'

// Term 1 2027 starts Monday 1 Feb (stored as Sydney midnight = previous day 13:00 UTC)
const term = { startDate: '2027-01-31T13:00:00.000Z', sessions: 10 }

describe('term dates', () => {
  it('gives 10 weekly dates starting from the first matching weekday', () => {
    const tue = termDatesForWeekday(term, 'Tuesday')
    expect(tue).toHaveLength(10)
    expect(tue[0]).toBe('2027-02-02')
    expect(tue[9]).toBe('2027-04-06')
  })
  it('includes the start day itself when it matches', () => {
    expect(termDatesForWeekday(term, 'Monday')[0]).toBe('2027-02-01')
  })
  it('skips a date and pushes the term later, keeping 10 sessions', () => {
    const withBreak = { ...term, skipDates: ['2027-03-08T13:00:00.000Z'] } // Tue 9 Mar (Sydney)
    const tue = termDatesForWeekday(withBreak, 'Tuesday')
    expect(tue).toHaveLength(10)
    expect(tue).not.toContain('2027-03-09')
    expect(tue[9]).toBe('2027-04-13')
    // other weekdays are unaffected
    expect(termDatesForWeekday(withBreak, 'Wednesday')[9]).toBe('2027-04-07')
  })
  it('ends on the last session of the latest weekday', () => {
    expect(termEndDate(term)).toBe('2027-04-11') // Sunday 11 Apr
  })
  it('converts slot times to UTC across the end of daylight saving (4 Apr 2027)', () => {
    const occ = slotOccurrences(term, 'Tuesday', '17:00')
    expect(occ[0].toISOString()).toBe('2027-02-02T06:00:00.000Z') // AEDT
    expect(occ[9].toISOString()).toBe('2027-04-06T07:00:00.000Z') // AEST after DST ends
  })
  it('summarises the schedule for admins', () => {
    expect(scheduleSummary({ ...term, skipDates: ['2027-03-08T13:00:00.000Z'] })).toContain('Tue: 2 Feb → 13 Apr (skips 9 Mar)')
  })
})
