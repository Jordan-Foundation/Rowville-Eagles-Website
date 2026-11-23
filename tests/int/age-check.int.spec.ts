import { describe, expect, it } from 'vitest'
import { ageBounds, ageOn, checkAge } from '../../src/lib/age-check'

describe('age check', () => {
  it('reads age ranges', () => {
    expect(ageBounds({ ageRange: 'Ages 5–13' })).toEqual({ min: 5, max: 13 })
    expect(ageBounds({ ageRange: 'Ages 2–5' })).toEqual({ min: 2, max: 5 })
    expect(ageBounds({ ageRange: 'U8 – U14' })).toEqual({ min: 8, max: 14, groups: true })
    expect(ageBounds({ ageRange: 'U5 – U11' })).toEqual({ min: 5, max: 11, groups: true })
    expect(ageBounds({ ageRange: '16+' })).toEqual({ min: 16, max: null })
    expect(ageBounds({ ageRange: 'All welcome' })).toEqual({ min: null, max: null })
    expect(ageBounds({ ageRange: 'Ages 5–13', minAge: 6, maxAge: 12 })).toEqual({ min: 6, max: 12 })
  })
  it('works out age', () => {
    expect(ageOn('2018-05-01', new Date(2026, 10, 8))).toBe(8)
    expect(ageOn('2018-11-09', new Date(2026, 10, 8))).toBe(7)
  })
  it('says whether the child fits', () => {
    const on = new Date(2026, 10, 8)
    expect(checkAge('2018-05-01', { min: 5, max: 13 }, 'Ava', on)).toEqual({ ok: true, message: 'Ava is 8 — right age for this program ✓' })
    expect(checkAge('2023-01-01', { min: 5, max: 13 }, 'Tiny', on)?.ok).toBe(false)
    expect(checkAge('2018-05-01', { min: null, max: null }, 'Ava', on)).toBeNull()
    // U-groups: a 2019-born turns 8 in 2027 (U8) and is 7 today — fits U8–U14; a 2020-born (U7) doesn't
    const u = ageBounds({ ageRange: 'U8 – U14' })
    expect(checkAge('2019-03-01', u, 'Ava', on)?.ok).toBe(true)
    expect(checkAge('2020-03-01', u, 'Sam', on)).toEqual({ ok: false, message: 'Sam is 6 — this program is for U8–U14. Please check, or contact us first.' })
  })
})
