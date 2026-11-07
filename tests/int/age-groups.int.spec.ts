import { describe, expect, it } from 'vitest'
import { birthYearFromLegacy, birthYearOf, checkMove, groupFor, groupInfo, miniRoosBirthYears, placementLabel, DEFAULT_RULES } from '@/lib/age-groups'

const r2026 = { season: 2026, ...DEFAULT_RULES }
const r2027 = { season: 2027, ...DEFAULT_RULES }

describe('rightful age group', () => {
  it('follows the FV MiniRoos table for 2026', () => {
    const table: [number, string][] = [[2020, '6s'], [2019, '7s'], [2018, '8s'], [2017, '9s'], [2016, '10s'], [2015, '11s']]
    for (const [by, hint] of table) expect(groupInfo(by, r2026)).toMatchObject({ kind: 'miniroos', hint, label: `${by}s` })
  })
  it('rolls over with the season setting — no hard-coded birth years', () => {
    expect(groupInfo(2021, r2027).hint).toBe('6s')
    expect(miniRoosBirthYears(r2027)).toEqual([2021, 2020, 2019, 2018, 2017, 2016])
  })
  it('flags players outside MiniRoos', () => {
    expect(groupInfo(2021, r2026)).toMatchObject({ kind: 'too-young', hint: 'Under 6' })
    expect(groupInfo(2013, r2026)).toMatchObject({ kind: 'junior', hint: 'U14', label: '2013s' })
    expect(groupInfo(2007, r2026)).toMatchObject({ kind: 'senior', label: 'Seniors' })
  })
  it('reads the birth year in Sydney time', () => {
    expect(birthYearOf('2017-01-01')).toBe(2017)
    expect(birthYearOf('2016-12-31T13:00:00.000Z')).toBe(2017) // saved as 1 Jan 2017 local midnight
    expect(groupFor('not a date', r2026)).toBeNull()
  })
})

describe('moving between age groups', () => {
  it('up is always allowed', () => {
    expect(checkMove(2017, 2014, r2026)).toMatchObject({ direction: 'up', steps: 3, allowed: true, warning: false })
  })
  it('down 1 is allowed, down 2 warns, down 3 is blocked', () => {
    expect(checkMove(2017, 2018, r2026)).toMatchObject({ direction: 'down', steps: 1, allowed: true, warning: false })
    expect(checkMove(2017, 2019, r2026)).toMatchObject({ steps: 2, allowed: true, warning: true })
    expect(checkMove(2017, 2020, r2026)).toMatchObject({ steps: 3, allowed: false })
  })
  it('the limits are settings', () => {
    expect(checkMove(2017, 2020, { ...r2026, maxDown: 3 }).allowed).toBe(true)
  })
  it('no rules outside MiniRoos', () => {
    expect(checkMove(2012, 2015, r2026)).toMatchObject({ ruled: false, allowed: true, warning: false })
  })
  it('shows rightful and playing groups', () => {
    expect(placementLabel(2017, 2016, r2026)).toBe('Born 2017 · rightful 2017s (9s) · playing in 2016s (10s)')
    expect(placementLabel(2017, null, r2026)).toBe('Born 2017 · 2017s · 9s')
  })
  it('converts legacy U-groups', () => {
    expect(birthYearFromLegacy('U10', 2027)).toBe(2018)
    expect(birthYearFromLegacy('Seniors', 2027)).toBeNull()
  })
})
