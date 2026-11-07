import { describe, expect, it } from 'vitest'
import { checkMoves, planTermMove, sameWeekDate } from '@/academy/reschedule'
import { localToUtc } from '@/lib/time'

const tue5 = (ymd: string) => localToUtc(ymd, '17:00').toISOString()
const sessions = ['2027-02-09', '2027-02-16', '2027-02-23'].map((d, i) => ({ id: i + 1, startsAt: tue5(d), coachId: 1 }))
const sam = { coachId: 1, slots: [{ weekday: 'Tuesday', startTime: '17:00' }, { weekday: 'Thursday', startTime: '16:00' }], away: [] as { from: string; to: string }[] }

describe('reschedule', () => {
  it('finds the same week’s new weekday', () => {
    expect(sameWeekDate('2027-02-09', 'Thursday')).toBe('2027-02-11') // Tue → Thu same week
    expect(sameWeekDate('2027-02-09', 'Monday')).toBe('2027-02-08')
    expect(sameWeekDate('2027-02-14', 'Monday')).toBe('2027-02-08') // Sunday belongs to the week starting Monday 8th
  })
  it('moves the rest of a term to a new day and time, keeping the number of sessions', () => {
    const moves = planTermMove({ sessions, weekday: 'Thursday', time: '16:00' })
    expect(moves.map((m) => m.to)).toEqual(['2027-02-11', '2027-02-18', '2027-02-25'].map((d) => localToUtc(d, '16:00').toISOString()))
    expect(moves).toHaveLength(3)
  })
  it('can hand the sessions to another coach', () => {
    expect(planTermMove({ sessions, weekday: 'Tuesday', time: '18:00', coachId: 2 }).every((m) => m.coachId === 2)).toBe(true)
  })
  it('blocks clashes and past dates; warns about availability, away dates and term end', () => {
    const moves = planTermMove({ sessions, weekday: 'Wednesday', time: '17:00' })
    const r = checkMoves(moves, {
      now: new Date('2027-02-10T12:00:00Z'), // after Wed 10 Feb 5pm
      termEnd: tue5('2027-02-20'),
      availability: [{ ...sam, away: [{ from: '2027-02-17T00:00:00Z', to: '2027-02-17T23:00:00Z' }] }],
      taken: [{ coachId: 1, startsAt: localToUtc('2027-02-24', '17:00').toISOString(), sessionId: 99 }],
    })
    expect(r.errors.join(' ')).toMatch(/in the past/)
    expect(r.errors.join(' ')).toMatch(/already has a session at Wed, 24 Feb/)
    expect(r.warnings.join(' ')).toMatch(/outside the coach’s set availability/)
    expect(r.warnings.join(' ')).toMatch(/away on Wed, 17 Feb/)
    expect(r.warnings.join(' ')).toMatch(/after the end of term/)
  })
  it('a session moving onto a time this booking is vacating is not a clash', () => {
    const moves = [{ sessionId: 1, from: sessions[0].startsAt, to: sessions[1].startsAt, coachId: 1 }, { sessionId: 2, from: sessions[1].startsAt, to: sessions[2].startsAt, coachId: 1 }]
    const r = checkMoves(moves, { now: new Date('2027-02-01T00:00:00Z'), availability: [sam], taken: sessions.slice(0, 2).map((s) => ({ coachId: 1, startsAt: s.startsAt, sessionId: s.id })) })
    expect(r.errors).toEqual([])
  })
})
