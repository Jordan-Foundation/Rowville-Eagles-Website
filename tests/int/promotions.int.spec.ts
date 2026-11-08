import { describe, expect, it } from 'vitest'
import { amountOff, bestPromo, covers, discountLabel, scopeEmpty, spread, usable, type LivePromo } from '../../src/promotions/rules'

describe('promotion scope — anything that costs money', () => {
  it('everything', () => {
    for (const t of [{ kind: 'shop', productId: 1 }, { kind: 'fplus' }, { kind: '1on1', termId: 2 }, { kind: 'tournament', roundId: 3 }, { kind: 'program', programId: 4, programType: 'holiday-camp' }] as const) expect(covers({ everything: true }, t)).toBe(true)
  })
  it('program groups and single programs', () => {
    expect(covers({ programGroups: ['holiday-camp'] }, { kind: 'program', programId: 9, programType: 'holiday-camp' })).toBe(true)
    expect(covers({ programGroups: ['holiday-camp'] }, { kind: 'program', programId: 9, programType: 'toddler' })).toBe(false)
    expect(covers({ programs: [9] }, { kind: 'program', programId: 9, programType: 'toddler' })).toBe(true)
    expect(covers({ programGroups: ['other'] }, { kind: 'program', programId: 9, programType: 'school-clinic' })).toBe(true)
    expect(covers({ programGroups: ['other'] }, { kind: 'program', programId: 9, programType: 'toddler' })).toBe(false)
  })
  it('1-on-1s, shop, tournaments, Foundation+', () => {
    expect(covers({ oneOnOneAll: true }, { kind: '1on1', termId: 5 })).toBe(true)
    expect(covers({ oneOnOneTerms: [4] }, { kind: '1on1', termId: 5 })).toBe(false)
    expect(covers({ shopAll: true }, { kind: 'shop', productId: 1 })).toBe(true)
    expect(covers({ products: [2] }, { kind: 'shop', productId: 1 })).toBe(false)
    expect(covers({ tournamentRounds: [7] }, { kind: 'tournament', roundId: 7 })).toBe(true)
    expect(covers({ foundationPlus: true }, { kind: 'fplus' })).toBe(true)
    expect(covers({ shopAll: true }, { kind: 'fplus' })).toBe(false)
  })
  it('empty scope', () => {
    expect(scopeEmpty({})).toBe(true)
    expect(scopeEmpty({ products: [1] })).toBe(false)
  })
})

describe('discount maths', () => {
  it('percent and fixed, capped at the amount', () => {
    expect(amountOff({ type: 'percent', value: 20 }, 199)).toBe(39.8)
    expect(amountOff({ type: 'amount', value: 15 }, 80)).toBe(15)
    expect(amountOff({ type: 'amount', value: 50 }, 30)).toBe(30)
    expect(amountOff({ type: 'percent', value: 150 }, 30)).toBe(30)
    expect(amountOff({ type: 'percent', value: 10 }, 0)).toBe(0)
  })
  it('spreads a discount across lines exactly', () => {
    const s = spread(10, [55, 30, 15])
    expect(s.reduce((a, b) => a + b, 0)).toBeCloseTo(10, 10)
    expect(s).toEqual([5.5, 3, 1.5])
    const odd = spread(10, [1, 1, 1])
    expect(Math.round(odd.reduce((a, b) => a + b, 0) * 100)).toBe(1000)
  })
  it('labels', () => {
    expect(discountLabel({ type: 'percent', value: 20 })).toBe('20% off')
    expect(discountLabel({ type: 'amount', value: 15 })).toBe('$15 off')
    expect(discountLabel({ type: 'amount', value: 7.5 })).toBe('$7.50 off')
  })
})

describe('which promotion applies', () => {
  const now = new Date('2027-05-10T00:00:00Z')
  const base: LivePromo = { id: 1, name: 'A', status: 'live', type: 'percent', value: 10, everything: true }
  it('dates, status and uses per family', () => {
    expect(usable(base, 0, now)).toBe(true)
    expect(usable({ ...base, status: 'draft' }, 0, now)).toBe(false)
    expect(usable({ ...base, startsAt: '2027-05-11T00:00:00Z' }, 0, now)).toBe(false)
    expect(usable({ ...base, endsAt: '2027-05-09T00:00:00Z' }, 0, now)).toBe(false)
    expect(usable({ ...base, usesPerFamily: 1 }, 1, now)).toBe(false)
    expect(usable({ ...base, usesPerFamily: 2 }, 1, now)).toBe(true)
  })
  it('picks the biggest saving', () => {
    const best = bestPromo([base, { ...base, id: 2, name: 'B', type: 'amount', value: 25 }], new Map(), () => 200, now)
    expect(best?.promo.name).toBe('B') // $25 beats 10% of $200
  })
})
