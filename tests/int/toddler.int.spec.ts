import { describe, expect, it } from 'vitest'
import { ageOnDate, toddlerAgeOk, toddlerYears, trialPlacesLeft } from '@/academy/terms/toddler'

describe('Mini Ballers', () => {
  it('works out age on the first session from the date of birth', () => {
    expect(ageOnDate('2023-02-10', '2025-02-09T12:00:00Z')).toBe(1) // 9 Feb, 11pm in Melbourne
    expect(ageOnDate('2023-02-10', '2025-02-09T22:00:00Z')).toBe(2) // already 10 Feb (9am) in Melbourne
    expect(ageOnDate('2023-02-10', '2025-02-10T03:00:00Z')).toBe(2)
    expect(ageOnDate('2020-06-01', '2026-05-31T03:00:00Z')).toBe(5)
    expect(ageOnDate('2020-06-01', '2026-06-01T03:00:00Z')).toBe(6)
  })
  it('accepts 2–5 year olds only', () => {
    const at = '2027-02-06T00:00:00Z'
    expect(toddlerAgeOk('2025-03-01', at).ok).toBe(false) // 1
    expect(toddlerAgeOk('2025-01-01', at).ok).toBe(true) // 2
    expect(toddlerAgeOk('2021-03-01', at).ok).toBe(true) // 5
    expect(toddlerAgeOk('2020-12-01', at).ok).toBe(false) // 6
    expect(toddlerYears('2027-02-01')).toEqual([2025, 2024, 2023, 2022, 2021])
  })
  it('limits trials by trial places and by capacity', () => {
    expect(trialPlacesLeft({ trialPlaces: 2, trialsBooked: 0, capacity: 10, enrolled: 5 })).toBe(2)
    expect(trialPlacesLeft({ trialPlaces: 2, trialsBooked: 1, capacity: 10, enrolled: 5 })).toBe(1)
    expect(trialPlacesLeft({ trialPlaces: 2, trialsBooked: 0, capacity: 10, enrolled: 9 })).toBe(1)
    expect(trialPlacesLeft({ trialPlaces: 2, trialsBooked: 1, capacity: 10, enrolled: 9 })).toBe(0)
    expect(trialPlacesLeft({ trialPlaces: 2, trialsBooked: 0, capacity: null, enrolled: 50 })).toBe(2)
  })
})
