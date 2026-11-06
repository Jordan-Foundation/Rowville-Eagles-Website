import { describe, expect, it } from 'vitest'
import { TZ, datesOnWeekday, localToUtc, localYmd } from '@/lib/time'

describe('Australia/Sydney time', () => {
  it('uses Sydney', () => expect(TZ).toBe('Australia/Sydney'))
  it('converts summer (AEDT, UTC+11) wall-clock times', () => {
    expect(localToUtc('2027-01-19', '17:30').toISOString()).toBe('2027-01-19T06:30:00.000Z')
  })
  it('converts winter (AEST, UTC+10) wall-clock times', () => {
    expect(localToUtc('2027-06-01', '17:30').toISOString()).toBe('2027-06-01T07:30:00.000Z')
  })
  it('handles the day daylight saving starts (4 Oct 2026)', () => {
    expect(localToUtc('2026-10-04', '18:00').toISOString()).toBe('2026-10-04T07:00:00.000Z')
    expect(localToUtc('2026-10-03', '18:00').toISOString()).toBe('2026-10-03T08:00:00.000Z')
  })
  it('gives the local calendar date for late-evening UTC instants', () => {
    expect(localYmd(new Date('2027-01-19T14:30:00Z'))).toBe('2027-01-20')
  })
  it('lists weekdays in a range', () => {
    expect(datesOnWeekday('2027-02-01', '2027-02-28', 'Tuesday')).toEqual(['2027-02-02', '2027-02-09', '2027-02-16', '2027-02-23'])
  })
})
