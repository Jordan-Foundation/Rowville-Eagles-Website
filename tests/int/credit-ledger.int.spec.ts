import { describe, expect, it } from 'vitest'
import { creditState, expiryFrom, type LedgerEntry } from '@/academy/credit-ledger'

const d = (s: string) => `${s}T00:00:00.000Z`
let id = 0
const give = (n: number, at: string, status: LedgerEntry['status'] = 'active'): LedgerEntry => ({ id: ++id, sessions: n, status, createdAt: d(at), expiresAt: expiryFrom(new Date(d(at))) })
const use = (n: number, at: string, status: LedgerEntry['status'] = 'active'): LedgerEntry => ({ id: ++id, sessions: -n, status, createdAt: d(at) })

describe('session credits', () => {
  it('adds up credits given and used', () => {
    const s = creditState([give(3, '2027-01-10'), use(1, '2027-02-01')], new Date(d('2027-03-01')))
    expect(s).toMatchObject({ available: 2, overdrawn: false })
  })
  it('expire 12 months after they are given', () => {
    expect(expiryFrom(new Date(d('2027-01-10')))).toBe(d('2028-01-10'))
    expect(creditState([give(2, '2027-01-10')], new Date(d('2028-01-11'))).available).toBe(0)
  })
  it('uses the soonest-expiring credit first', () => {
    const entries = [give(1, '2027-01-01'), give(1, '2027-06-01'), use(1, '2027-07-01')]
    const s = creditState(entries, new Date(d('2027-12-15')))
    expect(s.available).toBe(1)
    expect(s.nextExpiry).toEqual({ sessions: 1, at: d('2028-06-01') }) // the January credit was the one used
  })
  it('a credit used before it expired stays used', () => {
    const s = creditState([give(1, '2027-01-01'), use(1, '2027-12-30'), give(1, '2028-02-01')], new Date(d('2028-03-01')))
    expect(s).toMatchObject({ available: 1, overdrawn: false })
  })
  it('a checkout in progress holds the credit; an abandoned one gives it back', () => {
    expect(creditState([give(1, '2027-01-01'), use(1, '2027-02-01', 'pending')], new Date(d('2027-02-02'))).available).toBe(0)
    expect(creditState([give(1, '2027-01-01'), use(1, '2027-02-01', 'void')], new Date(d('2027-02-02'))).available).toBe(1)
  })
  it('spots two checkouts spending the same credit', () => {
    expect(creditState([give(1, '2027-01-01'), use(1, '2027-02-01', 'pending'), use(1, '2027-02-01', 'pending')], new Date(d('2027-02-02'))).overdrawn).toBe(true)
  })
})
