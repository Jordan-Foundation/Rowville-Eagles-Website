import { describe, expect, it } from 'vitest'
import { matches, summarise, type Contact } from '@/lib/audience'

const c = (o: Partial<Contact>): Contact => ({ email: 'a@example.com', name: 'Alex Smith', phone: '0412 345 678', sources: ['eagles-eoi'], heardFrom: [], players: [{ name: 'Sam Smith', birthYear: 2016 }], firstSeen: '2026-11-01T00:00:00Z', lastSeen: '2026-11-10T00:00:00Z', account: false, marketingEmail: false, marketingSms: false, ...o })

describe('audience search', () => {
  it('finds by name, email, player or mobile digits', () => {
    expect(matches(c({}), { q: 'alex' })).toBe(true)
    expect(matches(c({}), { q: 'A@EXAMPLE' })).toBe(true)
    expect(matches(c({}), { q: 'sam' })).toBe(true)
    expect(matches(c({}), { q: '345678' })).toBe(true)
    expect(matches(c({}), { q: 'zz' })).toBe(false)
  })
  it('filters by where they came from and marketing permission', () => {
    expect(matches(c({}), { source: 'camp' })).toBe(false)
    expect(matches(c({ sources: ['camp', 'account'] }), { source: 'camp' })).toBe(true)
    expect(matches(c({}), { optedIn: true })).toBe(false)
    expect(matches(c({ marketingSms: true }), { optedIn: true })).toBe(true)
  })
})

describe('audience overview', () => {
  it('counts families, new ones, permissions, sources, answers and months', () => {
    const now = new Date('2026-11-18T00:00:00Z')
    const all = [
      c({}),
      c({ email: 'b@example.com', sources: ['camp', 'import'], heardFrom: ['google'], marketingEmail: true, account: true, firstSeen: '2026-05-02T00:00:00Z', players: [] }),
    ]
    const s = summarise(all, now)
    expect(s).toMatchObject({ total: 2, new30: 1, marketingEmail: 1, marketingSms: 0, accounts: 1, players: 1 })
    expect(s.sources.find((x) => x.key === 'import')?.count).toBe(1)
    expect(s.heard.find((x) => x.key === 'google')?.count).toBe(1)
    expect(s.heard.find((x) => x.key === '')?.count).toBe(1)
    expect(s.months).toHaveLength(12)
    expect(s.months.at(-1)).toEqual({ month: '2026-11', count: 1 })
    expect(s.months.find((m) => m.month === '2026-05')?.count).toBe(1)
  })
})
