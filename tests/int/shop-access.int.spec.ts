import { describe, expect, it } from 'vitest'
import { canBuy, itemAccess, isPublicItem, type ShopViewer } from '@/lib/shop-access'

const viewer = (o: Partial<ShopViewer> = {}): ShopViewer => ({ userId: 7, groups: new Set(), teams: new Set(), ...o })
const item = (o: Record<string, unknown> = {}) => ({ audiences: [] as never[], teams: [], accounts: [], othersSee: 'locked' as const, ...o }) as never

describe('shop access', () => {
  it('everyone items are for anyone, even logged out', () => {
    expect(canBuy(item({ audiences: ['everyone'] }), viewer({ userId: null }))).toBe(true)
    expect(isPublicItem(item({ audiences: ['everyone'] }))).toBe(true)
  })
  it('any one match is enough: group, team or account', () => {
    const p = item({ audiences: ['rfa', 'foundation-plus'], teams: [{ id: 3 }], accounts: [9] })
    expect(canBuy(p, viewer())).toBe(false)
    expect(canBuy(p, viewer({ groups: new Set(['foundation-plus']) }))).toBe(true)
    expect(canBuy(p, viewer({ teams: new Set([3]) }))).toBe(true)
    expect(canBuy(p, viewer({ userId: 9 }))).toBe(true)
    expect(canBuy(p, viewer({ groups: new Set(['rowville']) }))).toBe(false)
  })
  it('locked vs hidden for everyone else', () => {
    expect(itemAccess(item({ audiences: ['rowville'] }), viewer(), true)).toMatchObject({ canBuy: false, label: 'For registered Rowville players' })
    expect(itemAccess(item({ audiences: ['rowville'], othersSee: 'hidden' }), viewer(), true)).toBeNull()
    expect(itemAccess(item({ teams: [3] }), viewer(), true)).toMatchObject({ label: 'Team members only' })
  })
  it('Foundation+-only items are left out while Foundation+ is off', () => {
    const p = item({ audiences: ['foundation-plus'] })
    expect(itemAccess(p, viewer(), false)).toBeNull()
    expect(itemAccess(p, viewer(), true)).toMatchObject({ canBuy: false, foundationPlus: true, label: 'Foundation+ members only' })
    expect(itemAccess(p, viewer({ groups: new Set(['foundation-plus']) }), false)).toMatchObject({ canBuy: true })
  })
})
