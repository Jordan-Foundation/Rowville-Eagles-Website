import { describe, expect, it } from 'vitest'
import { casualSlots, isCasualOpen, termSlots } from '@/academy/slots'
import { DEFAULT_HOURS, dayTypeOf, mergeTerms, startsIn, touchesBooking, VIC_SCHOOL_TERMS, windowOn, type BackToBack, type BookingHours } from '@/academy/hours'
import { WEEKDAYS } from '@/academy/constants'
import { localToUtc } from '@/lib/time'

const hours = (over: Partial<BookingHours> = {}): BookingHours => ({ ...DEFAULT_HOURS, closed: [], terms: VIC_SCHOOL_TERMS, ...over })
const all = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']
// One coach free every hour, every day
const coach = { coachId: 1, slots: WEEKDAYS.flatMap((weekday) => all.map((startTime) => ({ weekday, startTime }))), away: [] }
const at = (ymd: string, t: string) => localToUtc(ymd, t).toISOString()
const dayTimes = (slots: { date: string; time: string }[], ymd: string) => slots.filter((s) => s.date === ymd).map((s) => s.time)
const range = (start: string, end: string) => ({ startDate: localToUtc(start, '00:00').toISOString(), endDate: localToUtc(end, '23:59').toISOString() })
const now = new Date('2026-11-18T00:00:00Z')
const engine = (o: { h?: BookingHours; booked?: [string, string][]; b2b?: Partial<BackToBack> | false; term?: { startDate: string; endDate: string } } = {}) => {
  const booked = (o.booked ?? []).map(([d, t]) => ({ coachId: 1, startsAt: at(d, t), endsAt: new Date(localToUtc(d, t).getTime() + 3_600_000).toISOString() }))
  return {
    term: o.term ?? range('2026-12-19', '2027-02-28'),
    coaches: [coach],
    taken: booked.map((b) => ({ coachId: b.coachId, startsAt: b.startsAt })),
    now,
    cutoffHours: 24,
    hours: o.h ?? hours(),
    sessionMinutes: 60,
    backToBack: o.b2b === false ? null : { booked, off: [], releaseHours: 0, now, ...(o.b2b || {}) },
  }
}

describe('school calendar', () => {
  it('Victorian terms are seeded; dates outside a term are holidays', () => {
    expect(dayTypeOf('2026-12-18', VIC_SCHOOL_TERMS)).toBe('term')
    expect(dayTypeOf('2026-12-19', VIC_SCHOOL_TERMS)).toBe('holiday')
    expect(dayTypeOf('2027-01-15', VIC_SCHOOL_TERMS)).toBe('holiday') // summer
    expect(dayTypeOf('2027-01-27', VIC_SCHOOL_TERMS)).toBe('term')
    expect(dayTypeOf('2027-04-01', VIC_SCHOOL_TERMS)).toBe('holiday')
  })
  it('timeframe terms replace the seed for the years they cover', () => {
    const merged = mergeTerms([{ start: '2027-02-01', end: '2027-03-31' }])
    expect(dayTypeOf('2027-01-28', merged)).toBe('holiday') // seed's Term 1 start no longer applies
    expect(dayTypeOf('2026-12-01', merged)).toBe('term') // 2026 still from the seed
  })
  it('back-to-back starts fit inside the window', () => {
    expect(startsIn({ from: '16:00', to: '21:00' }, 60)).toEqual(['16:00', '17:00', '18:00', '19:00', '20:00'])
    expect(startsIn({ from: '07:00', to: '21:00' }, 60).at(-1)).toBe('20:00')
    expect(startsIn({ from: '16:00', to: '21:00' }, 45)).toEqual(['16:00', '16:45', '17:30', '18:15', '19:00', '19:45'])
  })
})

describe('default booking hours', () => {
  const noB2B = { b2b: false as const }
  it('a term weekday shows slots only 4pm–9pm', () => {
    const s = casualSlots(engine({ ...noB2B, term: range('2027-01-27', '2027-03-25') }))
    expect(dayTimes(s, '2027-02-03')).toEqual(['16:00', '17:00', '18:00', '19:00', '20:00']) // Wednesday
  })
  it('a term weekend and any holiday date show 7am–9pm', () => {
    const term = casualSlots(engine({ ...noB2B, term: range('2027-01-27', '2027-03-25') }))
    expect(dayTimes(term, '2027-02-06')).toEqual(all) // Saturday in Term 1
    const hol = casualSlots(engine(noB2B))
    expect(dayTimes(hol, '2027-01-06')).toEqual(all) // Wednesday in the summer holidays
  })
  it('closed dates show no slots', () => {
    const s = casualSlots(engine({ ...noB2B, h: hours({ closed: ['2026-12-25'] }) }))
    expect(dayTimes(s, '2026-12-25')).toEqual([])
    expect(dayTimes(s, '2026-12-24')).toEqual(all)
  })
  it('editing a term date immediately changes which hours apply', () => {
    const extended = hours({ terms: mergeTerms([{ start: '2027-01-04', end: '2027-03-25' }]) })
    expect(windowOn('2027-01-06', extended)).toEqual(DEFAULT_HOURS.termWeekday)
    expect(dayTimes(casualSlots(engine({ ...noB2B, h: extended })), '2027-01-06')).toEqual(['16:00', '17:00', '18:00', '19:00', '20:00'])
  })
})

describe('back-to-back (family booking pages)', () => {
  const d = '2027-01-06' // holiday Wednesday, 7am–9pm
  it('an empty day shows every available slot', () => {
    expect(dayTimes(casualSlots(engine()), d)).toEqual(all)
  })
  it('booking 10–11am shows only 9–10am and 11am–12pm', () => {
    expect(dayTimes(casualSlots(engine({ booked: [[d, '10:00']] })), d)).toEqual(['09:00', '11:00'])
  })
  it('then booking 11am–12pm shows 9–10am and 12–1pm', () => {
    expect(dayTimes(casualSlots(engine({ booked: [[d, '10:00'], [d, '11:00']] })), d)).toEqual(['09:00', '12:00'])
  })
  it('separate blocks: 9–10am and 2–3pm show 8–9, 10–11, 1–2, 3–4', () => {
    expect(dayTimes(casualSlots(engine({ booked: [[d, '09:00'], [d, '14:00']] })), d)).toEqual(['08:00', '10:00', '13:00', '15:00'])
  })
  it('on a term weekday a 4–5pm booking shows only 5–6pm', () => {
    const term = range('2027-01-27', '2027-03-25')
    expect(dayTimes(casualSlots(engine({ term, booked: [['2027-02-03', '16:00']] })), '2027-02-03')).toEqual(['17:00'])
  })
  it('other days are unaffected; cancelling the only booking shows all slots again', () => {
    expect(dayTimes(casualSlots(engine({ booked: [[d, '10:00']] })), '2027-01-07')).toEqual(all)
    expect(dayTimes(casualSlots(engine({ booked: [] })), d)).toEqual(all)
  })
  it('internal booking (no rule) still shows every free slot', () => {
    expect(dayTimes(casualSlots(engine({ booked: [[d, '10:00']], b2b: false })), d)).toHaveLength(all.length - 1)
  })
  it('a hidden slot is rejected on submit', () => {
    const e = engine({ booked: [[d, '10:00']] })
    expect(isCasualOpen({ ...e, coachId: 1, startsAt: at(d, '15:00') })).toBe(false)
    expect(isCasualOpen({ ...e, coachId: 1, startsAt: at(d, '11:00') })).toBe(true)
  })
  it('per-coach off switch and the release window', () => {
    expect(dayTimes(casualSlots(engine({ booked: [[d, '10:00']], b2b: { off: [1] } })), d)).toHaveLength(all.length - 1)
    const late = new Date(localToUtc(d, '00:00').getTime() - 10 * 3_600_000) // 10 hours before the day
    const b: BackToBack = { booked: [{ coachId: 1, startsAt: at(d, '10:00'), endsAt: at(d, '11:00') }], off: [], releaseHours: 12, now: late }
    expect(touchesBooking(1, at(d, '15:00'), 60, b)).toBe(true)
    expect(touchesBooking(1, at(d, '15:00'), 60, { ...b, releaseHours: 6 })).toBe(false)
  })
  it('sessions of different lengths: adjacency is exact', () => {
    const b: BackToBack = { booked: [{ coachId: 1, startsAt: at(d, '10:00'), endsAt: at(d, '10:45') }], off: [], releaseHours: 0, now }
    expect(touchesBooking(1, at(d, '10:45'), 60, b)).toBe(true)
    expect(touchesBooking(1, at(d, '11:00'), 60, b)).toBe(false)
    expect(touchesBooking(1, at(d, '09:00'), 60, b)).toBe(true)
  })
  it('weekly term bookings apply the rule to every date', () => {
    const term = range('2027-01-27', '2027-03-25')
    const free = termSlots({ ...engine({ term }), minSessions: 2 }).find((s) => s.weekday === 'Wednesday' && s.time === '18:00')
    expect(free).toBeTruthy()
    // A 4pm booking on one Wednesday: 6pm no longer passes that day; 5pm touches it (and the other, empty Wednesdays pass)
    const busy = termSlots({ ...engine({ term, booked: [['2027-02-10', '16:00']] }), minSessions: 2 })
    expect(busy.some((s) => s.weekday === 'Wednesday' && s.time === '18:00')).toBe(false)
    expect(busy.some((s) => s.weekday === 'Wednesday' && s.time === '17:00')).toBe(true)
  })
})
