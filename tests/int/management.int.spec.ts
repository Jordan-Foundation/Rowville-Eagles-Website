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
