import { describe, expect, it } from 'vitest'
import { placeInSlot } from '@/academy/terms/placement'
import { coachClashes } from '@/academy/terms/clashes'
import { slotSessions, type SlotShape } from '@/academy/terms/slots'
import { DEFAULT_RULES } from '@/lib/age-groups'

const rules = { ...DEFAULT_RULES, season: 2027 }
const term = { startDate: '2027-01-27T00:00:00.000Z', endDate: '2027-04-01T00:00:00.000Z' }
const slot = (o: Partial<SlotShape> = {}): SlotShape => ({ id: 1, weekday: 'Tuesday', startTime: '17:00', endTime: '18:00', birthYears: [2017, 2018], ...o })

describe('placing players in training times', () => {
  it('plays in their own year when the time includes it', () => {
    expect(placeInSlot(2017, [2017, 2018], rules)).toMatchObject({ playingBirthYear: null, isMove: false })
  })
  it('moves up to the closest older year (always allowed)', () => {
    const p = placeInSlot(2019, [2017, 2018], rules)
    expect(p).toMatchObject({ playingBirthYear: 2018, isMove: true })
    expect(p.check).toMatchObject({ direction: 'up', allowed: true })
  })
  it('warns moving down 2 and blocks moving down 3 (MiniRoos)', () => {
    expect(placeInSlot(2016, [2018], rules).check).toMatchObject({ direction: 'down', steps: 2, allowed: true, warning: true })
    expect(placeInSlot(2016, [2019], rules).check).toMatchObject({ steps: 3, allowed: false })
  })
})

describe('coach clashes', () => {
  const sessions = slotSessions(slot(), term)
  it('finds overlapping times, 1-on-1s and away dates', () => {
    const thu = slotSessions(slot({ weekday: 'Tuesday', startTime: '17:30', endTime: '18:30' }), term).map((s) => ({ ...s, label: 'Tuesday 5:30pm (2019s)' }))
    const w = coachClashes({
      coach: 'Coach Lee',
      sessions,
      busy: [...thu, { label: 'a 1-on-1', startsAt: '2027-02-16T06:30:00.000Z', endsAt: '2027-02-16T07:30:00.000Z' }],
      away: [{ from: '2027-03-01T00:00:00.000Z', to: '2027-03-12T00:00:00.000Z' }],
      now: new Date('2027-01-01'),
    })
    expect(w[0]).toMatch(/Coach Lee also has Tuesday 5:30pm \(2019s\) at the same time on 9 dates/)
    expect(w[1]).toMatch(/a 1-on-1 at the same time on Tue, 16 Feb/)
    expect(w[2]).toMatch(/away on Tue, 2 Mar, Tue, 9 Mar/)
  })
  it('ignores back-to-back sessions and past dates', () => {
    const after = slotSessions(slot({ startTime: '18:00', endTime: '19:00' }), term).map((s) => ({ ...s, label: 'later' }))
    expect(coachClashes({ coach: 'C', sessions, busy: after, away: [], now: new Date('2027-01-01') })).toEqual([])
    expect(coachClashes({ coach: 'C', sessions, busy: [{ label: 'x', startsAt: '2027-02-02T06:00:00.000Z', endsAt: '2027-02-02T07:00:00.000Z' }], away: [], now: new Date('2027-03-01') })).toEqual([])
  })
})
