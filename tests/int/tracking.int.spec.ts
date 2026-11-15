import { describe, expect, it } from 'vitest'
import { bookingCategory, conversionFor, isTrackable, trackingAllowed, trackingConfig } from '@/tracking/config'

describe('ad tracking', () => {
  it('reads the settings', () => {
    expect(trackingConfig(null)).toBeNull()
    expect(trackingConfig({ metaPixelId: ' 472931888098255 ' })).toEqual({ meta: '472931888098255', google: [], ads: null, adsLead: null, adsPurchase: null })
    const c = trackingConfig({ googleTagIds: 'aw-123456789, G-ABC123, nonsense', adsLeadLabel: 'AbC' })!
    expect(c.google).toEqual(['AW-123456789', 'G-ABC123'])
    expect(c.ads).toBe('AW-123456789')
    expect(c.adsLead).toBe('AbC')
    expect(trackingConfig({ metaPixelId: 'abc' })).toBeNull()
  })
  it('only runs on the live site', () => {
    expect(trackingAllowed({ VERCEL_ENV: 'production' })).toBe(true)
    expect(trackingAllowed({ VERCEL_ENV: 'preview' })).toBe(false)
    expect(trackingAllowed({})).toBe(false)
  })
  it('never on staff or private-link pages', () => {
    const q = (s = '') => new URLSearchParams(s)
    expect(isTrackable('/', q())).toBe(true)
    expect(isTrackable('/academy/trial', q())).toBe(true)
    expect(isTrackable('/checkout/success', q('kind=booking&ref=RFA-1'))).toBe(true)
    for (const p of ['/management', '/management/invoices', '/coach/sessions', '/camp-coach/x', '/invoice/RFA-1/tok', '/academy/group/abc', '/account/activate', '/selections/pay/REF', '/admin']) expect(isTrackable(p, q())).toBe(false)
    expect(isTrackable('/academy/1-on-1', q('link=abc'))).toBe(false)
    expect(isTrackable('/programs/x', q('t=abc'))).toBe(false)
    expect(isTrackable('/managementish', q())).toBe(true)
  })
  it('lead or purchase', () => {
    expect(conversionFor({ category: 'trial', amount: 0, ref: 'R' })).toEqual({ kind: 'lead', category: 'trial', value: 0, ref: 'R' })
    expect(conversionFor({ category: 'camp', amount: 300, ref: 'R' }).kind).toBe('purchase')
    expect(conversionFor({ category: 'trial', amount: 20, ref: 'R', lead: true }).kind).toBe('lead')
    expect(bookingCategory({ bookingType: 'trial' }, 'academy-term')).toBe('trial')
    expect(bookingCategory({}, 'holiday-camp')).toBe('camp')
    expect(bookingCategory({}, 'toddler')).toBe('academy-term')
  })
})
