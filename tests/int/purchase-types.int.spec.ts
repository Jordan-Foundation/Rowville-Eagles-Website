import { describe, expect, it } from 'vitest'
import { academyPurchaseType, bookingPurchaseType, purchaseTypeLabel } from '@/promotions/purchase-types'
import { matchesAudience } from '@/promotions/audience'

describe('purchase tags', () => {
  it('tags bookings by what they are', () => {
    expect(bookingPurchaseType({}, 'holiday-camp')).toBe('type:camp')
    expect(bookingPurchaseType({ bookingType: 'trial' }, 'academy-term')).toBe('type:academy-trial')
    expect(bookingPurchaseType({}, 'academy-year')).toBe('type:academy-term')
    expect(bookingPurchaseType({}, 'toddler')).toBe('type:mini-ballers')
    expect(bookingPurchaseType({}, 'registration')).toBe('type:club-registration')
    expect(bookingPurchaseType({}, 'community')).toBeNull()
    expect(academyPurchaseType({ kind: 'group' })).toBe('type:small-group')
    expect(academyPurchaseType({ kind: 'one-on-one', packSize: 3 })).toBe('type:holiday-pack')
    expect(academyPurchaseType({ kind: 'one-on-one' })).toBe('type:1on1')
    expect(purchaseTypeLabel('type:camp')).toBe('Holiday camps')
  })
  it('promotions can target a tag', () => {
    const fam = { userId: 1, email: 'a@b.c', memberships: new Set<string>(), history: new Set(['type:camp']), birthYears: new Set<number>(), teams: new Set<number>() }
    expect(matchesAudience({ mode: 'filter', history: ['type:camp'] }, fam)).toBe(true)
    expect(matchesAudience({ mode: 'filter', history: ['type:small-group'] }, fam)).toBe(false)
  })
})
