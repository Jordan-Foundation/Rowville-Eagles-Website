import { describe, expect, it } from 'vitest'
import { ageOn, canMarkAttendance, coachRole, sessionPayment } from '@/academy/session-view'

describe('session view helpers', () => {
  it('works out age on a date', () => {
    expect(ageOn('2013-08-08', new Date('2027-08-07T12:00:00Z'))).toBe(13)
    expect(ageOn('2013-08-08', new Date('2027-08-09T12:00:00Z'))).toBe(14)
  })
  it('labels payment for each kind of booking', () => {
    const s = { paid: false, startsAt: '2027-02-11T05:00:00.000Z' }
    expect(sessionPayment({ ...s, paid: true }, { paymentMode: 'upfront', type: 'term', status: 'confirmed', amount: 720, sessionsTotal: 9 }).label).toBe('Term paid in full')
    expect(sessionPayment({ ...s, paid: true }, { paymentMode: 'casual', type: 'casual', status: 'confirmed', amount: 85, sessionsTotal: 1 }).label).toBe('Paid')
    expect(sessionPayment(s, { paymentMode: 'weekly', type: 'term', status: 'payment_failed', amount: 720, sessionsTotal: 9 })).toMatchObject({ label: 'Payment overdue', tone: 'bad' })
    expect(sessionPayment(s, { paymentMode: 'weekly', type: 'term', status: 'confirmed', amount: 720, sessionsTotal: 9 }).label).toBe('$80 charged Tue, 9 Feb')
  })
  it('opens attendance 15 minutes before the start', () => {
    const start = '2027-02-11T05:00:00.000Z'
    expect(canMarkAttendance(start, new Date('2027-02-11T04:40:00Z'))).toBe(false)
    expect(canMarkAttendance(start, new Date('2027-02-11T04:46:00Z'))).toBe(true)
  })
  it('knows who is running a session', () => {
    expect(coachRole({ coach: 1, coverCoach: null, needsCover: false }, 1)).toBe('coach')
    expect(coachRole({ coach: 1, coverCoach: 2, needsCover: true }, 1)).toBe('covered')
    expect(coachRole({ coach: 1, coverCoach: 2, needsCover: true }, 2)).toBe('cover')
    expect(coachRole({ coach: 1, coverCoach: null, needsCover: true }, 1)).toBe('coach')
    expect(coachRole({ coach: 1, coverCoach: null, needsCover: false }, 3)).toBeNull()
  })
})
