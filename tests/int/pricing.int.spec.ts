import { describe, expect, it } from 'vitest'
import { casualPrice } from '@/academy/pricing'

const term = { casualPrice: 85, termMemberPrice: 70, termMemberWindowDays: 14 }
const now = new Date('2027-02-01T00:00:00Z')
const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000).toISOString()

describe('term member casual price', () => {
  it('is $70 for term families, for sessions in the next 14 days', () => {
    expect(casualPrice(term, { startsAt: inDays(3), now, termMember: true })).toEqual({ price: 70, memberPrice: true })
    expect(casualPrice(term, { startsAt: inDays(14), now, termMember: true }).price).toBe(70)
  })
  it('is the normal price beyond the window — no booking a whole extra term cheaply', () => {
    expect(casualPrice(term, { startsAt: inDays(15), now, termMember: true })).toEqual({ price: 85, memberPrice: false })
  })
  it('is the normal price without an active term booking', () => {
    expect(casualPrice(term, { startsAt: inDays(3), now, termMember: false }).price).toBe(85)
  })
  it('the window moves with the booking date', () => {
    const later = new Date('2027-03-01T00:00:00Z')
    expect(casualPrice(term, { startsAt: '2027-03-10T06:00:00.000Z', now: later, termMember: true }).price).toBe(70)
  })
})
