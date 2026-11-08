import { describe, expect, it } from 'vitest'
import { icsFile } from '../../src/lib/ics'

describe('calendar files', () => {
  it('timed events in UTC, escaped text', () => {
    const f = icsFile([{ uid: 'a@x', title: 'Camp, day 1; fun', start: '2027-01-12T22:00:00.000Z', end: '2027-01-13T04:00:00.000Z', location: '208 Dandelion Drive, Rowville' }])
    expect(f).toContain('BEGIN:VCALENDAR\r\n')
    expect(f).toContain('DTSTART:20270112T220000Z')
    expect(f).toContain('DTEND:20270113T040000Z')
    expect(f).toContain('SUMMARY:Camp\\, day 1\\; fun')
    expect(f).toContain('LOCATION:208 Dandelion Drive\\, Rowville')
  })
  it('all-day events use Melbourne dates and an exclusive end', () => {
    const f = icsFile([{ uid: 'b@x', title: 'Camp', start: '2027-01-12T22:00:00.000Z', end: '2027-01-15T04:00:00.000Z', allDay: true }])
    expect(f).toContain('DTSTART;VALUE=DATE:20270113')
    expect(f).toContain('DTEND;VALUE=DATE:20270116')
  })
  it('folds long lines', () => {
    const f = icsFile([{ uid: 'c@x', title: 'x'.repeat(200), start: '2027-01-12T22:00:00.000Z' }])
    expect(f.split('\r\n').every((l) => l.length <= 75)).toBe(true)
  })
})
