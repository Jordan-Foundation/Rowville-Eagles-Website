import { describe, expect, it } from 'vitest'
import { clubFeeNote, fullTermPrice, fullYearQuote, perTermQuote, slotCounts } from '../../src/academy/terms/pricing'

describe('Academy term pricing', () => {
  it('per term: $400 for 2 a week, pro-rata for late joiners', () => {
    const p = { pricingMode: 'per-term', termPrice: 400 }
    expect(perTermQuote(p, [{ all: 9, left: 9 }, { all: 9, left: 9 }])).toMatchObject({ total: 400, proRata: false, shares: [200, 200] })
    // 6 of 18 sessions left → $133.33
    const q = perTermQuote(p, [{ all: 9, left: 3 }, { all: 9, left: 3 }])
    expect(q.total).toBe(133.33)
    expect(q.shares[0] + q.shares[1]).toBeCloseTo(133.33, 2)
    expect(q.proRata).toBe(true)
    // only one training time for the age group → half price
    expect(perTermQuote(p, [{ all: 10, left: 10 }]).total).toBe(200)
  })
  it('counts sessions in the term and still to come (24h cutoff)', () => {
    const slot = { id: 1, weekday: 'Tuesday', startTime: '17:00', endTime: '18:00' }
    const term = { startDate: '2027-01-27T13:00:00.000Z', endDate: '2027-03-25T12:59:00.000Z' }
    expect(slotCounts(slot, term, new Date('2027-01-01T00:00:00Z'))).toEqual({ all: 8, left: 8 })
    expect(slotCounts(slot, term, new Date('2027-03-10T00:00:00Z'))).toEqual({ all: 8, left: 2 })
  })
  it('whole-term prices and the full year at 10% off', () => {
    expect(fullTermPrice({ pricingMode: 'per-term', termPrice: 400 }, [{ all: 9 }, { all: 9 }])).toBe(400)
    expect(fullTermPrice({ pricePerSession: 25 }, [{ all: 10 }])).toBe(250)
    expect(fullYearQuote([400, 250, 225, 400], 10)).toEqual({ sum: 1275, total: 1147.5, saving: 127.5, pct: 10 })
  })
  it('club fee note', () => {
    expect(clubFeeNote(950)).toBe('Academy fees do not include the $950 Rowville Eagles player registration.')
    expect(clubFeeNote(null)).toContain('$950')
  })
})
