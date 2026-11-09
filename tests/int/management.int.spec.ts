import { describe, expect, it } from 'vitest'
import { homeFor } from '@/lib/home'
import { badgeLabel, badgeText } from '@/components/dashboard/badge'

describe('home for each account type', () => {
  it('sends Management, coaches and families to their own home', () => {
    expect(homeFor({ roles: ['admin'] })).toBe('/management')
    expect(homeFor({ roles: ['committee', 'parent'] })).toBe('/management')
    expect(homeFor({ roles: ['coach', 'committee'] })).toBe('/management') // both → Management by default
    expect(homeFor({ roles: ['coach', 'parent'] })).toBe('/coach')
    expect(homeFor({ roles: ['parent'] })).toBe('/account')
    expect(homeFor({ roles: [] })).toBe('/account')
    expect(homeFor(null)).toBe('/login')
  })
})

describe('dashboard badges', () => {
  it('hides 0, shows the number, caps at 99+', () => {
    expect(badgeText(0)).toBeNull()
    expect(badgeText(undefined)).toBeNull()
    expect(badgeText(7)).toBe('7')
    expect(badgeText(99)).toBe('99')
    expect(badgeText(100)).toBe('99+')
    expect(badgeLabel('Messages', 10)).toBe('Messages, 10 need attention')
    expect(badgeLabel('Cover', 1)).toBe('Cover, 1 needs attention')
    expect(badgeLabel('Messages', 0)).toBe('Messages')
  })
})

import { cardPrice, priceBreakdown } from '@/lib/format'

describe('program card prices', () => {
  it('shows the lowest option with "from" when there is a choice', () => {
    expect(cardPrice({ type: 'academy-term', price: 0, pricePerSession: 25, twoNightPricePerSession: 20 })).toEqual({ from: true, amount: 20, unit: '/ session' })
    expect(cardPrice({ type: 'academy-term', price: 0, pricePerSession: 25, twoNightPricePerSession: null })).toEqual({ from: false, amount: 25, unit: '/ session' })
    expect(cardPrice({ type: 'academy-term', pricePerSession: 20, twoNightPricePerSession: 20 })).toMatchObject({ from: false, amount: 20 })
    expect(cardPrice({ type: 'holiday-camp', price: 180 })).toEqual({ from: false, amount: 180, unit: null })
    expect(priceBreakdown({ type: 'academy-term', pricePerSession: 25, twoNightPricePerSession: 20 }).map((r) => r.price)).toEqual(['$25 / session', '$20 / session'])
  })
})

import { badgeMeaning } from '@/components/dashboard/badge'
describe('badge meanings', () => {
  it('say what the number is', () => {
    expect(badgeMeaning('store', 3, 'management')).toBe('3 to fulfil')
    expect(badgeMeaning('reports', 2, 'coach')).toBe('2 to write')
    expect(badgeMeaning('reports', 2, 'management')).toBe('2 to review')
    expect(badgeMeaning('messages', 150)).toBe('99+ unread')
    expect(badgeMeaning('store', 0)).toBeNull()
  })
})
