import { describe, expect, it } from 'vitest'
import { laterWeeks, restOfTermQuote, termRateFrom, week1Credit } from '@/academy/group-term'
import { localToUtc } from '@/lib/time'

// Term 1 2027: Mon 1 Feb – Fri 2 Apr (no breaks in this shape)
const term = { startDate: '2027-02-01T00:00:00.000Z', endDate: '2027-04-02T00:00:00.000Z' }

describe('later weeks after a one-off group', () => {
  it('every later week at the same weekday and time (Sydney)', () => {
    const oneOff = localToUtc('2027-02-06', '09:00').toISOString() // Saturday 9am
    const r = laterWeeks(term, oneOff, { now: new Date('2027-02-01T00:00:00Z'), cutoffHours: 24 })
    expect(r.weekday).toBe('Saturday')
    expect(r.time).toBe('09:00')
    expect(r.weeks[0]).toBe(localToUtc('2027-02-13', '09:00').toISOString())
    expect(r.weeks).toHaveLength(7) // 13, 20, 27 Feb; 6, 13, 20, 27 Mar
    expect(r.weeks.every((w) => w > oneOff)).toBe(true)
  })
  it('skips weeks inside the booking cut-off', () => {
    const oneOff = localToUtc('2027-02-06', '09:00').toISOString()
    const r = laterWeeks(term, oneOff, { now: new Date(localToUtc('2027-02-12', '12:00')), cutoffHours: 24 })
    expect(r.weeks[0]).toBe(localToUtc('2027-02-20', '09:00').toISOString())
  })
  it('none left at the end of term', () => {
    const oneOff = localToUtc('2027-03-27', '09:00').toISOString()
    expect(laterWeeks(term, oneOff, { now: new Date('2027-03-20T00:00:00Z'), cutoffHours: 24 }).weeks).toHaveLength(0)
  })
})

describe('rest-of-term price', () => {
  it('the week-1 difference comes off', () => {
    expect(week1Credit(60, 54)).toBe(6)
    expect(week1Credit(50, 54)).toBe(0)
  })
  it('group of 3: 7 more weeks at $54, less the $6 already overpaid for week 1', () => {
    expect(restOfTermQuote(60, 10, 7, 60)).toEqual({ rate: 54, weeks: 7, full: 378, credit: 6, total: 372, saving: 48 })
  })
  it('group of 2: $63 a week', () => {
    expect(restOfTermQuote(70, 10, 4, 70).total).toBe(63 * 4 - 7)
  })
  it('term price comes from the group’s locked one-off price', () => {
    expect(termRateFrom(60, 10)).toBe(54)
    expect(termRateFrom(55, 15)).toBe(46.75)
    expect(termRateFrom(60, 150)).toBe(0)
  })
})
