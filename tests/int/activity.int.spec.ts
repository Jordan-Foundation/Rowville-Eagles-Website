import { describe, expect, it } from 'vitest'
import { diff, show } from '@/lib/activity'

describe('activity log', () => {
  it('lists only the watched fields that changed, as people read them', () => {
    const d = diff({ price: 165, status: 'open', title: 'Camp', startDate: '2027-01-12T22:00:00.000Z' }, { price: 175, status: 'open', title: 'Camp', startDate: '2027-01-13T22:00:00.000Z' }, { price: 'Price', status: 'Status', startDate: 'Starts' })
    expect(d.map((x) => x.label)).toEqual(['Price', 'Starts'])
    expect(d[0]).toEqual({ field: 'price', label: 'Price', from: '165', to: '175' })
    expect(d[1].to).toContain('14 Jan 2027')
  })
  it('creation shows the starting values', () => {
    expect(diff(null, { price: 20 }, { price: 'Price' })).toEqual([{ field: 'price', label: 'Price', from: '—', to: '20' }])
    expect(show(true)).toBe('Yes')
    expect(show('')).toBe('—')
  })
})
