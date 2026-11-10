import { describe, expect, it } from 'vitest'
import { defaultDeadline, holidaysFor, setupDue, setupYear, termProblems } from '../../src/academy/yearly'

// Victorian 2027 terms (sample)
const T = [
  { start: '2027-01-28', end: '2027-03-25' },
  { start: '2027-04-12', end: '2027-06-25' },
  { start: '2027-07-12', end: '2027-09-17' },
  { start: '2027-10-04', end: '2027-12-17' },
]

describe('Yearly setup', () => {
  it('checks the term dates', () => {
    expect(termProblems(2027, T)).toEqual([])
    expect(termProblems(2027, [T[0], T[1], { start: '2027-06-20', end: '2027-09-17' }, T[3]])).toEqual(['Term 3 starts before Term 2 ends.'])
    expect(termProblems(2027, [{ start: '2027-03-01', end: '2027-02-01' }, T[1], T[2], T[3]])).toEqual(['Term 1: the last day is before the first day.'])
    expect(termProblems(2028, T)[0]).toBe('Term 1: the dates should be in 2028.')
    expect(termProblems(2027, [{ start: '', end: '' }, T[1], T[2], T[3]])[0]).toContain('enter both')
  })
  it('works out the holidays from the gaps (summer from last year’s Term 4)', () => {
    expect(holidaysFor(T, '2026-12-18')).toEqual([
      { period: 'summer', start: '2026-12-19', end: '2027-01-27' },
      { period: 'april', start: '2027-03-26', end: '2027-04-11' },
      { period: 'mid-year', start: '2027-06-26', end: '2027-07-11' },
      { period: 'september', start: '2027-09-18', end: '2027-10-03' },
    ])
    expect(holidaysFor(T)[0].start).toBe('2026-12-19')
  })
  it('availability due 3 weeks before', () => {
    expect(defaultDeadline('2027-04-12')).toBe('2027-03-22')
  })
  it('November: next year is due until published', () => {
    expect(setupYear(new Date('2026-11-10T00:00:00Z'))).toBe(2027)
    expect(setupYear(new Date('2026-06-10T00:00:00Z'))).toBe(2026)
    expect(setupDue(new Date('2026-10-31T10:00:00Z'), [])).toBeNull() // 31 Oct 9pm Sydney
    expect(setupDue(new Date('2026-10-31T14:00:00Z'), [])).toBe(2027) // 1 Nov 1am Sydney
    expect(setupDue(new Date('2026-11-20T00:00:00Z'), [2027])).toBeNull()
  })
})
