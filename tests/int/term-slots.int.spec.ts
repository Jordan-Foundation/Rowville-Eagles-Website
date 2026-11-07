import { describe, expect, it } from 'vitest'
import { slotChoice, slotLabel, slotSessions, termQuote, upcomingSessions, yearsLabel, type SlotShape } from '@/academy/terms/slots'

const term = { startDate: '2027-01-27T00:00:00.000Z', endDate: '2027-04-01T00:00:00.000Z' } // Wed 27 Jan → Thu 1 Apr (Sydney)
const slot = (o: Partial<SlotShape> = {}): SlotShape => ({ id: 1, weekday: 'Tuesday', startTime: '17:00', endTime: '18:00', venue: 'Rowville Reserve', birthYears: [2017, 2018], ...o })

describe('academy term slots', () => {
  it('runs on the slot weekday for the whole term, in Sydney time', () => {
    const s = slotSessions(slot(), term)
    expect(s.length).toBe(9) // Tuesdays 2 Feb … 30 Mar
    expect(s[0].date).toBe('2027-02-02')
    expect(s[0].startsAt).toBe('2027-02-02T06:00:00.000Z') // 5pm AEDT
    expect(s.at(-1)!.date).toBe('2027-03-30')
  })
  it('applies cancelled and moved weeks', () => {
    const s = slotSessions(slot({ exceptions: [{ date: '2027-02-09', cancelled: true }, { date: '2027-02-16', startTime: '16:30', endTime: '17:30', note: 'Pitch change' }] }), term)
    expect(s[1]).toMatchObject({ cancelled: true })
    expect(s[2]).toMatchObject({ moved: true, startsAt: '2027-02-16T05:30:00.000Z', note: 'Pitch change' })
    expect(upcomingSessions(slot({ exceptions: [{ date: '2027-02-09', cancelled: true }] }), term, new Date('2027-01-01')).length).toBe(8)
  })
  it('picks the slot automatically, lets parents choose, or falls back to interest', () => {
    const a = slot({ id: 1 }), b = slot({ id: 2, weekday: 'Thursday' }), c = slot({ id: 3, birthYears: [2016], capacity: 2 })
    expect(slotChoice([a, c], 2017, new Map()).mode).toBe('auto')
    expect(slotChoice([a, b, c], 2018, new Map()).mode).toBe('choose')
    expect(slotChoice([a, b, c], 2015, new Map())).toMatchObject({ mode: 'interest', reason: 'no_slot' })
    expect(slotChoice([a, b, c], 2016, new Map([[3, 2]]))).toMatchObject({ mode: 'interest', reason: 'full' })
    expect(slotChoice([a, slot({ id: 2, active: false })], 2017, new Map()).mode).toBe('auto')
  })
  it('labels slots for families', () => {
    expect(slotLabel(slot({ startTime: '17:30', endTime: '18:45' }))).toBe('Tuesday 5:30pm–6:45pm · Rowville Reserve')
    expect(yearsLabel([2018, 2016, 2017])).toBe('2018s, 2017s & 2016s')
  })
  it('prices per session for the sessions left, like 1-on-1 terms', () => {
    const tue = slot({ exceptions: [{ date: '2027-02-09', cancelled: true }] }) // 8 sessions, 2 Feb … 30 Mar
    expect(termQuote(tue, term, { pricePerSession: 25 }, new Date('2027-01-01'))).toMatchObject({ count: 8, total: 200, bookable: true })
    // Mon 1 Feb 6pm: Tue 2 Feb 5pm is inside the 24h cut-off
    expect(termQuote(tue, term, { pricePerSession: 25 }, new Date('2027-02-01T07:00:00Z'))).toMatchObject({ count: 7, total: 175 })
    expect(termQuote(tue, term, { pricePerSession: 25 }, new Date('2027-03-24T00:00:00Z'))).toMatchObject({ count: 1, bookable: false })
    expect(termQuote(tue, term, { price: 440 }, new Date('2027-01-01'))).toMatchObject({ perSession: null, total: 440 })
    expect(slotChoice([tue], 2017, new Map(), (s) => termQuote(s, term, { pricePerSession: 25 }, new Date('2027-03-24')).bookable).mode).toBe('interest')
  })
})
