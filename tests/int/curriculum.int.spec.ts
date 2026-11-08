import { describe, expect, it } from 'vitest'
import data from '../../src/academy/curriculum/curriculum-data.json'
import { LEVELS, STRANDS, levelFor, levelForAge } from '../../src/academy/curriculum/levels'

const src = data as Record<string, Record<string, { standard: string; descriptors: { code: string; text: string }[] }>>

describe('curriculum data', () => {
  it('has every level × strand with a standard', () => {
    expect(Object.keys(src).sort()).toEqual(LEVELS.map((l) => l.key).sort())
    for (const l of LEVELS) for (const s of STRANDS) {
      const st = src[l.key][s.key]
      expect(st, `${l.key} ${s.key}`).toBeTruthy()
      expect(st.standard).toMatch(/^By the end of/)
      expect(st.descriptors.length).toBeGreaterThan(0)
    }
  })
  it('has every descriptor code in order (FF-level-STRANDnn)', () => {
    let n = 0
    for (const l of LEVELS) for (const s of STRANDS) {
      src[l.key][s.key].descriptors.forEach((d, i) => {
        expect(d.code).toBe(`FF-${l.key}-${s.key}${String(i + 1).padStart(2, '0')}`)
        expect(d.text.length).toBeGreaterThan(10)
        n++
      })
    }
    expect(n).toBe(239)
  })
})

describe('levelFor', () => {
  it('maps age numbers to levels', () => {
    expect(levelForAge(4)).toBeNull()
    expect(levelForAge(5)).toBe('F')
    expect(levelForAge(7)).toBe('F')
    expect(levelForAge(8)).toBe('8')
    expect(levelForAge(12)).toBe('12')
    expect(levelForAge(13)).toBe('13')
    expect(levelForAge(16)).toBe('13')
  })
  it('uses the player age group by default', () => {
    expect(levelFor({ season: 2027, birthYear: 2018 })).toEqual({ level: '9', ageNumber: 9, source: 'age' })
  })
  it('follows a move up/down into another age group', () => {
    expect(levelFor({ season: 2027, birthYear: 2018, playingBirthYear: 2017 })).toEqual({ level: '10', ageNumber: 9, source: 'moved' })
  })
  it('a level set on the report wins', () => {
    expect(levelFor({ season: 2027, birthYear: 2018, playingBirthYear: 2017, override: '8' }).level).toBe('8')
    expect(levelFor({ season: 2027, birthYear: 2018, override: 'nope' }).level).toBe('9')
  })
  it('no report for Mini Ballers, too-young or unknown age', () => {
    expect(levelFor({ season: 2027, birthYear: 2024, toddler: true }).level).toBeNull()
    expect(levelFor({ season: 2027, birthYear: 2024 }).level).toBeNull()
    expect(levelFor({ season: 2027, birthYear: null }).level).toBeNull()
  })
})
