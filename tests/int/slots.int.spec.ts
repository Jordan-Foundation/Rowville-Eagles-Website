import { describe, expect, it } from 'vitest'
import { casualSlots, isCasualOpen } from '@/academy/slots'

// Term: Mon 1 Feb – Thu 1 Apr 2027 (Sydney)
const term = { startDate: '2027-01-31T13:00:00.000Z', endDate: '2027-04-01T12:59:00.000Z' }
const now = new Date('2027-02-01T00:00:00Z') // Mon 1 Feb, 11am Sydney
const sam = { coachId: 1, slots: [{ weekday: 'Tuesday' as const, startTime: '17:00' }], away: [] }
const priya = { coachId: 2, slots: [{ weekday: 'Tuesday' as const, startTime: '17:00' }, { weekday: 'Saturday' as const, startTime: '09:00' }], away: [] }
const base = { term, coaches: [sam, priya], taken: [], now, cutoffHours: 24 }

describe('casual slots', () => {
  it('groups coaches free at the same time', () => {
    const first = casualSlots(base)[0]
    expect(first).toMatchObject({ date: '2027-02-02', time: '17:00', coachIds: [1, 2] })
    expect(first.startsAt).toBe('2027-02-02T06:00:00.000Z')
  })
  it('lists every week of the term', () => {
    expect(casualSlots(base).filter((s) => s.time === '17:00')).toHaveLength(9) // 9 Tuesdays
  })
  it('respects the booking cut-off', () => {
    const lateNow = new Date('2027-02-01T07:00:00Z') // Mon 6pm — Tue 5pm is under 24h away
    expect(casualSlots({ ...base, now: lateNow })[0].date).not.toBe('2027-02-02')
  })
  it('removes a coach from a time that is already booked or held', () => {
    const slots = casualSlots({ ...base, taken: [{ coachId: 1, startsAt: '2027-02-02T06:00:00.000Z' }] })
    expect(slots[0].coachIds).toEqual([2])
  })
  it('drops the time entirely when every coach is taken', () => {
    const taken = [1, 2].map((coachId) => ({ coachId, startsAt: '2027-02-02T06:00:00.000Z' }))
    expect(casualSlots({ ...base, taken })[0].date).not.toBe('2027-02-02')
  })
  it('never offers a coach on a day they are away', () => {
    const away = { ...sam, away: [{ from: '2027-02-08T13:00:00.000Z', to: '2027-02-14T12:59:00.000Z' }] } // 9–14 Feb
    const tue9 = casualSlots({ ...base, coaches: [away, priya] }).find((s) => s.date === '2027-02-09')!
    expect(tue9.coachIds).toEqual([2])
  })
  it('checks one exact coach + time', () => {
    expect(isCasualOpen({ ...base, coachId: 1, startsAt: '2027-02-02T06:00:00.000Z' })).toBe(true)
    expect(isCasualOpen({ ...base, coachId: 1, startsAt: '2027-02-06T22:00:00.000Z' })).toBe(false) // Sam doesn't work Saturday
  })
})

import { findTermSlot, termSlots } from '@/academy/slots'

describe('term slots', () => {
  const termBase = { ...base, minSessions: 2 }
  it('offers a weekly slot with every remaining session', () => {
    const tue5 = termSlots(termBase).find((s) => s.weekday === 'Tuesday' && s.time === '17:00')!
    expect(tue5.coachIds).toEqual([1, 2])
    expect(tue5.sessions).toHaveLength(9)
    expect(tue5.sessions[0]).toBe('2027-02-02T06:00:00.000Z')
  })
  it('counts only sessions after the cut-off, so the price drops as weeks pass', () => {
    const midTerm = new Date('2027-03-01T00:00:00Z') // Mon 1 Mar
    const tue5 = termSlots({ ...termBase, now: midTerm }).find((s) => s.weekday === 'Tuesday')!
    expect(tue5.sessions).toHaveLength(5) // 2, 9, 16, 23, 30 Mar
  })
  it('needs the minimum number of sessions left', () => {
    const lateTerm = new Date('2027-03-22T00:00:00Z') // only Tue 23 & 30 Mar left
    expect(termSlots({ ...termBase, now: lateTerm }).some((s) => s.weekday === 'Tuesday')).toBe(true)
    expect(termSlots({ ...termBase, now: lateTerm, minSessions: 3 }).some((s) => s.weekday === 'Tuesday')).toBe(false)
  })
  it('is not offered for a coach if any remaining week is already taken (e.g. a casual booking)', () => {
    const taken = [{ coachId: 1, startsAt: '2027-03-09T06:00:00.000Z' }]
    const tue5 = termSlots({ ...termBase, taken }).find((s) => s.weekday === 'Tuesday')!
    expect(tue5.coachIds).toEqual([2])
  })
  it('still offers a coach who is away some weeks, listing those dates', () => {
    const away = { ...sam, away: [{ from: '2027-02-28T13:00:00.000Z', to: '2027-03-06T12:59:00.000Z' }] } // 1–6 Mar
    const tue5 = termSlots({ ...termBase, coaches: [away, priya] }).find((s) => s.weekday === 'Tuesday')!
    expect(tue5.coachIds).toEqual([1, 2])
    expect(tue5.awayDates[1]).toEqual(['2027-03-02'])
    expect(tue5.awayDates[2]).toBeUndefined()
  })
  it('finds one exact coach + weekday + time', () => {
    expect(findTermSlot({ ...termBase, coachId: 2, weekday: 'Saturday', time: '09:00' })?.sessions).toHaveLength(8)
    expect(findTermSlot({ ...termBase, coachId: 1, weekday: 'Saturday', time: '09:00' })).toBeNull()
  })
})
