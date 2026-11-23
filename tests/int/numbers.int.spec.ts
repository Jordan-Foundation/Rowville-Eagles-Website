import { describe, expect, it } from 'vitest'
import { freeNumbers, numbersIn, picksNumber, rangeFor, rangeProblem, seedRanges } from '@/numbers/rules'

const rules = { season: 2027, miniMin: 5, miniMax: 11 } as never

describe('shirt number ranges', () => {
  it('youngest year 51–99, next 2–50, alternating; seniors not included', () => {
    const r = seedRanges(rules)
    expect(r[0]).toEqual({ birthYear: 2022, start: 51, end: 99 })
    expect(r[1]).toEqual({ birthYear: 2021, start: 2, end: 50 })
    expect(r[2]).toEqual({ birthYear: 2020, start: 51, end: 99 })
    expect(r.at(-1)!.birthYear).toBe(2009) // U18 in 2027 — the oldest junior year
    expect(r.every((x) => x.start > 1)).toBe(true)
  })
  it('a new, younger year continues the pattern; stored years never change', () => {
    const stored = seedRanges(rules)
    expect(rangeFor(2023, stored)).toEqual({ birthYear: 2023, start: 2, end: 50 })
    expect(rangeFor(2024, stored)).toEqual({ birthYear: 2024, start: 51, end: 99 })
    // Next season the same years keep their ranges (seeding is only for years not stored yet)
    expect(rangeFor(2020, stored)).toEqual({ birthYear: 2020, start: 51, end: 99 })
    expect(rangeFor(2021, [{ birthYear: 2021, start: 60, end: 80 }])).toEqual({ birthYear: 2021, start: 60, end: 80 }) // edited by Management
  })
  it('number 1 is never offered or allowed', () => {
    expect(numbersIn({ start: 2, end: 50 })[0]).toBe(2)
    expect(numbersIn({ start: 1, end: 5 })).toEqual([2, 3, 4, 5])
    expect(rangeProblem({ start: 1, end: 50 })).toMatch(/goalkeeper/)
    expect(rangeProblem({ start: 51, end: 99 })).toBeNull()
    expect(rangeProblem({ start: 60, end: 50 })).toMatch(/start before/)
    expect(freeNumbers({ start: 2, end: 6 }, [3, 5])).toEqual([2, 4, 6])
  })
  it('seniors don’t pick numbers', () => {
    expect(picksNumber(2015, rules)).toBe(true)
    expect(picksNumber(2005, rules)).toBe(false)
    expect(picksNumber(null, rules)).toBe(false)
  })
})
