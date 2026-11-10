import { describe, expect, it } from 'vitest'
import { checkPack, packSaving, packSettings, packTotal, parsePackSizes } from '../../src/academy/packs'

describe('Holiday packs', () => {
  it('sizes and price default to 3 or 5 at $80', () => {
    expect(packSettings({})).toEqual({ sizes: [3, 5], price: 80 })
    expect(parsePackSizes('5, 3, 3, 40')).toEqual([3, 5])
    expect(parsePackSizes('nonsense')).toEqual([3, 5])
  })
  it('exactly 3 or 5 open times, any days, sorted', () => {
    const open = () => true
    const a = ['2027-01-20T05:00:00.000Z', '2027-01-12T05:00:00.000Z', '2027-01-27T07:00:00.000Z']
    expect(checkPack({ starts: a, sizes: [3, 5], isOpen: open })).toEqual({ ok: true, starts: [a[1], a[0], a[2]] })
    expect(checkPack({ starts: a.slice(0, 2), sizes: [3, 5], isOpen: open })).toMatchObject({ ok: false, error: 'Choose exactly 3 or 5 sessions for a holiday pack.' })
    expect(checkPack({ starts: [a[0], a[0], a[1]], sizes: [3, 5], isOpen: open })).toMatchObject({ ok: false })
    expect(checkPack({ starts: a, sizes: [3, 5], isOpen: (s) => s !== a[2] })).toMatchObject({ ok: false, error: expect.stringContaining('just been booked') })
  })
  it('totals and saving vs casual $85', () => {
    expect(packTotal(3, 80)).toBe(240)
    expect(packTotal(5, 80)).toBe(400)
    expect(packSaving(5, 80, 85)).toBe(25)
  })
})
