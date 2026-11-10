import { describe, expect, it } from 'vitest'
import { agesLabel, dayGroups, groupCount, groupLabelText, keepTogetherUnits, matchKeepWith, planCampGroups, type CampKid } from '../../src/lib/camp-groups'

// n children, one per month of birth, oldest first (2014-01 … ), ids 1..n
const kids = (n: number): CampKid[] => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Kid${i + 1} Test`, dob: `${2014 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-01` }))
const sizes = (m: Map<number, number>) => { const c = new Map<number, number>(); for (const g of m.values()) c.set(g, (c.get(g) ?? 0) + 1); return [...c.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n) }

describe('Camp groups', () => {
  it('fewest groups of 8–12; fewer than 8 → one group', () => {
    expect([1, 7, 8, 12, 13, 24, 25, 37].map((n) => groupCount(n))).toEqual([1, 1, 1, 1, 2, 2, 3, 4])
    expect(sizes(planCampGroups(kids(5)))).toEqual([5])
    expect(sizes(planCampGroups(kids(12)))).toEqual([12])
    expect(sizes(planCampGroups(kids(13)))).toEqual([7, 6])
  })
  it('25 children → 9, 8, 8, youngest in group 1', () => {
    const m = planCampGroups(kids(25))
    expect(sizes(m)).toEqual([9, 8, 8])
    expect(m.get(25)).toBe(1) // youngest
    expect(m.get(1)).toBe(3) // oldest
    // similar ages together: group numbers never go up as children get younger
    const byAge = [...m.entries()].sort((a, b) => a[0] - b[0]).map(([, g]) => g)
    expect(byAge).toEqual([...byAge].sort((a, b) => b - a))
  })
  it('locked children stay put; the rest fill around them', () => {
    const list = kids(25)
    list[0].lockedGroup = 1 // the oldest, put in the youngest group by hand
    const m = planCampGroups(list)
    expect(m.get(1)).toBe(1)
    expect(sizes(m)).toEqual([9, 8, 8])
  })
  it('a lock in a new group number makes that group', () => {
    const list = kids(10)
    list[3].lockedGroup = 2
    const m = planCampGroups(list)
    expect(m.get(4)).toBe(2)
    expect(new Set(m.values()).size).toBe(2)
  })
  it('siblings booked together and keep-with requests stay together', () => {
    const list = kids(24)
    list[0].checkoutGroup = 'ABC'; list[23].checkoutGroup = 'ABC' // oldest + youngest siblings
    list[5].keepWith = 'Kid20 Test'
    const units = keepTogetherUnits(list)
    expect(units.find((u) => u.some((k) => k.id === 1))!.map((k) => k.id).sort((a, b) => a - b)).toEqual([1, 24])
    const m = planCampGroups(list)
    expect(m.get(1)).toBe(m.get(24))
    expect(m.get(6)).toBe(m.get(20))
    expect(Math.max(...sizes(m))).toBeLessThanOrEqual(12)
  })
  it('keep-with matching: full name, or a first name only one child has', () => {
    const k = [{ id: 1, name: 'Leo Smith' }, { id: 2, name: 'Leo Jones' }, { id: 3, name: 'Ava Brown' }, { id: 4, name: 'Mia Lee' }]
    expect(matchKeepWith('leo smith please', k, 4)).toEqual([1])
    expect(matchKeepWith('Leo', k, 4)).toEqual([]) // two Leos
    expect(matchKeepWith('my friend Ava', k, 4)).toEqual([3])
    expect(matchKeepWith('', k, 4)).toEqual([])
  })
  it('per day: a small group joins its neighbour', () => {
    expect(dayGroups(new Map([[1, 9], [2, 4], [3, 8]]))).toEqual([[1], [2, 3]])
    expect(dayGroups(new Map([[1, 9], [2, 8], [3, 3]]))).toEqual([[1], [2, 3]])
    expect(dayGroups(new Map([[1, 3], [2, 2]]))).toEqual([[1, 2]])
    expect(dayGroups(new Map([[1, 9], [2, 0], [3, 8]]))).toEqual([[1], [3]])
  })
  it('labels', () => {
    expect(groupLabelText(2, [8, 9, 9], 11)).toBe('Group 2 – ages 8–9 – 11 kids')
    expect(agesLabel([7])).toBe('age 7')
  })
})
