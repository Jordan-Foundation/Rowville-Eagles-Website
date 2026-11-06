import { describe, expect, it } from 'vitest'
import { isAway, scheduleSummary, slotOccurrences, termDatesForWeekday } from '@/academy/term-dates'
import { startTimesFor } from '@/academy/constants'

// Sample school term: Mon 1 Feb – Thu 1 Apr 2027 (dates stored as Sydney midnight = 13:00 UTC the day before)
const term = { startDate: '2027-01-31T13:00:00.000Z', endDate: '2027-04-01T12:59:00.000Z' }

describe('term dates follow the school term', () => {
  it('counts sessions per weekday — they can differ', () => {
    expect(termDatesForWeekday(term, 'Monday')).toHaveLength(9) // 1 Feb … 29 Mar
    expect(termDatesForWeekday(term, 'Thursday')).toHaveLength(9) // 4 Feb … 1 Apr
    expect(termDatesForWeekday(term, 'Friday')).toHaveLength(8) // 5 Feb … 26 Mar
  })
  it('includes the first and last day of the term', () => {
    expect(termDatesForWeekday(term, 'Monday')[0]).toBe('2027-02-01')
    expect(termDatesForWeekday(term, 'Thursday').at(-1)).toBe('2027-04-01')
  })
  it('handles an 11-week term (Mondays 11, Saturdays 10)', () => {
    const long = { startDate: '2027-07-11T14:00:00.000Z', endDate: '2027-09-23T13:59:00.000Z' } // Mon 12 Jul – Fri 24 Sep
    expect(termDatesForWeekday(long, 'Monday')).toHaveLength(11)
    expect(termDatesForWeekday(long, 'Saturday')).toHaveLength(10) // 17 Jul … 18 Sep — weekdays vary
  })
  it('converts slot times to UTC (AEDT)', () => {
    const occ = slotOccurrences(term, 'Tuesday', '17:00')
    expect(occ[0].toISOString()).toBe('2027-02-02T06:00:00.000Z')
  })
  it('summarises the schedule for admins', () => {
    expect(scheduleSummary(term)).toContain('Mon: 9 sessions · 1 Feb → 29 Mar')
  })
})

describe('start times', () => {
  const t = { slotStartTimes: [{ time: '15:00' }, { time: '20:00' }], weekendStartTimes: [{ time: '08:00' }, { time: '16:00' }] }
  it('uses weekend hours on Saturday and Sunday', () => {
    expect(startTimesFor(t, 'Saturday')).toEqual(['08:00', '16:00'])
    expect(startTimesFor(t, 'Sunday')).toEqual(['08:00', '16:00'])
    expect(startTimesFor(t, 'Wednesday')).toEqual(['15:00', '20:00'])
  })
})

describe('away periods', () => {
  const away = [{ from: '2027-02-28T13:00:00.000Z', to: '2027-03-06T13:00:00.000Z' }] // 1–7 Mar Sydney
  it('detects dates inside an away period (inclusive)', () => {
    expect(isAway('2027-03-01', away)).toBe(true)
    expect(isAway('2027-03-07', away)).toBe(true)
    expect(isAway('2027-03-08', away)).toBe(false)
  })
})
