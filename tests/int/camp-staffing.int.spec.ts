import { describe, expect, it } from 'vitest'
import { blockedStarts, campDayRanges, coachesNeeded, escalationDue, overlaps, reminderDue, staffingGap } from '../../src/lib/camp-staffing'

describe('Camp staffing', () => {
  it('1 per group + 1 extra; none with no children', () => {
    expect(coachesNeeded({ maxGroups: 3, perGroup: 1, extra: 1 })).toBe(4)
    expect(coachesNeeded({ maxGroups: 2, perGroup: 2, extra: 0 })).toBe(4)
    expect(coachesNeeded({ maxGroups: 0, perGroup: 1, extra: 1 })).toBe(0)
  })
  it('short, waiting and over-staffed', () => {
    expect(staffingGap({ needed: 4, confirmed: 2, invited: 1 })).toEqual({ short: 1, over: 0, waiting: 1 })
    expect(staffingGap({ needed: 3, confirmed: 4, invited: 0 })).toEqual({ short: 0, over: 1, waiting: 0 })
  })
  it('reminder after 24h, Management after 48h, once each', () => {
    const invitedAt = '2027-01-01T00:00:00Z'
    expect(reminderDue({ invitedAt, now: new Date('2027-01-01T23:00:00Z'), hours: 24 })).toBe(false)
    expect(reminderDue({ invitedAt, now: new Date('2027-01-02T00:00:00Z'), hours: 24 })).toBe(true)
    expect(reminderDue({ invitedAt, remindedAt: '2027-01-02T00:00:00Z', now: new Date('2027-01-03T00:00:00Z'), hours: 24 })).toBe(false)
    expect(escalationDue({ invitedAt, now: new Date('2027-01-03T00:00:00Z'), hours: 48 })).toBe(true)
  })
  it('camp days as Sydney time ranges; overlap', () => {
    const [d] = campDayRanges([{ date: '2027-01-18', start: '09:00', end: '15:00' }])
    expect(d).toEqual({ date: '2027-01-18', from: '2027-01-17T22:00:00.000Z', to: '2027-01-18T04:00:00.000Z' })
    expect(overlaps(d, { from: '2027-01-18T03:30:00.000Z', to: '2027-01-18T04:30:00.000Z' })).toBe(true)
    expect(overlaps(d, { from: '2027-01-18T04:00:00.000Z', to: '2027-01-18T05:00:00.000Z' })).toBe(false)
  })
  it('a camp day blocks 1-on-1 start times that overlap it, not the ones after', () => {
    const [d] = campDayRanges([{ date: '2027-01-18', start: '09:00', end: '15:00' }])
    const times = (ymd: string) => (ymd === '2027-01-18' ? ['08:00', '09:00', '14:00', '15:00', '16:00'] : ['10:00'])
    const out = blockedStarts([{ coachId: 7, ...d }], times, 60).map((x) => x.startsAt)
    expect(out).toEqual(['2027-01-17T22:00:00.000Z', '2027-01-18T03:00:00.000Z'])
  })
})
