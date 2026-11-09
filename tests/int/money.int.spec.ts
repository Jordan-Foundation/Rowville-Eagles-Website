import { describe, expect, it } from 'vitest'
import { summarise, type Entry } from '@/lib/money'

describe('money summary', () => {
  const e: Entry[] = [
    { category: 'one-on-one', payee: 'academy', at: '2026-11-03T01:00:00Z', gross: 85, discount: 0 },
    { category: 'one-on-one', payee: 'academy', at: '2026-11-04T01:00:00Z', gross: 68, discount: 17 },
    { category: 'one-on-one', payee: 'academy', at: '2026-11-10T01:00:00Z', refund: 85 },
    { category: 'registrations', payee: 'club', at: '2026-11-05T01:00:00Z', gross: 220 },
    { category: 'shop', payee: 'academy', at: '2026-12-01T01:00:00Z', gross: 35 },
  ]
  it('adds up by category and by Stripe account, inside the dates only', () => {
    const s = summarise(e, '2026-11-01T00:00:00Z', '2026-11-30T23:59:59Z')
    expect(s.lines.map((l) => l.category)).toEqual(['one-on-one', 'registrations'])
    expect(s.lines[0]).toMatchObject({ count: 2, gross: 153, discount: 17, refunds: 85, net: 68 })
    expect(s.accounts.club).toEqual({ gross: 220, refunds: 0, net: 220 })
    expect(s.accounts.academy).toEqual({ gross: 153, refunds: 85, net: 68 })
    expect(s.total).toMatchObject({ count: 3, gross: 373, net: 288 })
  })
})
