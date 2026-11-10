import { describe, expect, it } from 'vitest'
import { campChoiceLabel, campDayList, campHoursLabel, campPrices, campQuote, fullCampSaving, placesByDay, weekdaysBetween } from '../../src/lib/camps'

const prices = { full: 300, day: 110 }
const all = ['2027-01-11', '2027-01-12', '2027-01-13', '2027-01-14']

describe('Camp days', () => {
  it('weekdays only, inclusive', () => {
    expect(weekdaysBetween('2027-01-08', '2027-01-12')).toEqual(['2027-01-08', '2027-01-11', '2027-01-12'])
  })
  it('falls back to the weekdays between the start and end dates (Sydney), times from those dates', () => {
    // Mon 11 Jan 9am – Thu 14 Jan 3pm Sydney (AEDT +11)
    const days = campDayList({ startDate: '2027-01-10T22:00:00.000Z', endDate: '2027-01-14T04:00:00.000Z' })
    expect(days.map((d) => d.date)).toEqual(all)
    expect(days[0]).toEqual({ date: '2027-01-11', start: '09:00', end: '15:00' })
  })
  it('uses the days set on the camp, sorted, without duplicates', () => {
    const days = campDayList({ campDays: [{ date: '2027-01-12T13:00:00.000Z', startTime: '08:30', endTime: '14:30' }, { date: '2027-01-10T13:00:00.000Z' }, { date: '2027-01-12T13:00:00.000Z' }] })
    expect(days).toEqual([{ date: '2027-01-11', start: '09:00', end: '15:00' }, { date: '2027-01-13', start: '08:30', end: '14:30' }])
  })
  it('prices default to $300 / $110', () => {
    expect(campPrices({})).toEqual({ full: 300, day: 110 })
    expect(campPrices({ fullCampPrice: 280, dayPrice: 100 })).toEqual({ full: 280, day: 100 })
  })
  it('labels', () => {
    expect(campHoursLabel({ start: '09:00', end: '15:30' })).toBe('9am–3:30pm')
    expect(campChoiceLabel({ fullCamp: true, days: all, totalDays: 4 })).toBe('Full camp (4 days)')
    expect(campChoiceLabel({ fullCamp: false, days: ['2027-01-11', '2027-01-13'], totalDays: 4 })).toBe('Mon 11 Jan, Wed 13 Jan')
  })
})

describe('Camp pricing', () => {
  it('full camp', () => {
    expect(campQuote({ allDays: all, full: true, days: [], prices })).toMatchObject({ fullCamp: true, total: 300, days: all })
    expect(fullCampSaving(prices, 4)).toBe(140)
  })
  it('chosen days, no suggestion while cheaper', () => {
    expect(campQuote({ allDays: all, full: false, days: ['2027-01-11', '2027-01-12'], prices })).toMatchObject({ fullCamp: false, total: 220, suggestFull: false, saving: 0 })
  })
  it('suggests the full camp once the days cost more', () => {
    expect(campQuote({ allDays: all, full: false, days: all.slice(0, 3), prices })).toMatchObject({ total: 330, suggestFull: true, saving: 30 })
  })
  it('every day ticked counts as the full camp; unknown days are ignored', () => {
    expect(campQuote({ allDays: all, full: false, days: [...all, '2030-01-01'], prices })).toMatchObject({ fullCamp: true, total: 300 })
    expect(campQuote({ allDays: all, full: false, days: ['2030-01-01'], prices })).toBeNull()
    expect(campQuote({ allDays: [], full: true, days: [], prices })).toBeNull()
  })
})

describe('Places per day', () => {
  it('full-camp and older bookings count every day', () => {
    const m = placesByDay(all, [{ fullCamp: true }, {}, { campDays: [{ day: '2027-01-12' }, { day: '2027-01-14' }] }])
    expect([...m.values()]).toEqual([2, 3, 2, 3])
  })
})
