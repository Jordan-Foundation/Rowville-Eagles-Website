import { describe, expect, it } from 'vitest'
import { audienceIds, matchesAudience, parseEmails, smsBody, type Family } from '../../src/promotions/audience'

const fam = (userId: number, o: Partial<{ m: string[]; h: string[]; y: number[]; t: number[] }> = {}): Family => ({
  userId, email: `f${userId}@x.com`, memberships: new Set(o.m ?? []), history: new Set(o.h ?? []), birthYears: new Set(o.y ?? []), teams: new Set(o.t ?? []),
})
const families = [fam(1, { m: ['rfa'], y: [2016] }), fam(2, { m: ['rowville'], y: [2016], t: [7] }), fam(3, { m: ['rfa', 'foundation-plus'], y: [2014], h: ['1on1'] }), fam(4)]

describe('promotion audience', () => {
  it('everyone', () => {
    expect(audienceIds({ mode: 'all' }, families).ids).toEqual([1, 2, 3, 4])
  })
  it('any match within a filter', () => {
    expect(audienceIds({ mode: 'filter', memberships: ['rfa', 'rowville'] }, families).ids).toEqual([1, 2, 3])
  })
  it('all filters must match', () => {
    expect(audienceIds({ mode: 'filter', memberships: ['rfa'], birthYears: [2016] }, families).ids).toEqual([1])
    expect(audienceIds({ mode: 'filter', history: ['1on1'], memberships: ['foundation-plus'] }, families).ids).toEqual([3])
    expect(audienceIds({ mode: 'filter', teams: [7] }, families).ids).toEqual([2])
  })
  it('a filter with nothing ticked matches nobody', () => {
    expect(matchesAudience({ mode: 'filter' }, families[0])).toBe(false)
  })
  it('hand-picked by email, on their own or on top of a filter; unknown emails reported', () => {
    expect(audienceIds({ mode: 'picked', emails: 'F4@x.com, nobody@x.com' }, families)).toEqual({ ids: [4], unknown: ['nobody@x.com'] })
    expect(audienceIds({ mode: 'filter', teams: [7], emails: 'f4@x.com' }, families).ids).toEqual([2, 4])
  })
  it('parses pasted emails', () => {
    expect(parseEmails('a@x.com\nB@x.com; a@x.com, not-an-email')).toEqual(['a@x.com', 'b@x.com'])
  })
  it('marketing texts always end with the opt-out', () => {
    expect(smsBody('20% off holiday camps this week', 'Foundation Academy')).toBe('20% off holiday camps this week. – Foundation Academy. Reply STOP to opt out')
    expect(smsBody('Book now!', 'Rowville Eagles FC')).toBe('Book now! – Rowville Eagles FC. Reply STOP to opt out')
  })
})
