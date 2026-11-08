import { describe, expect, it } from 'vitest'
import { hashShareToken, holdUntil, linkExpiry, linkState, newShareToken, validShareToken } from '@/academy/share-rules'

const now = new Date('2026-11-10T00:00:00Z')

describe('coach share links', () => {
  it('makes unguessable tokens and stores only a hash', () => {
    const t = newShareToken()
    expect(validShareToken(t)).toBe(true)
    expect(hashShareToken(t)).toHaveLength(64)
    expect(hashShareToken(t)).not.toContain(t)
    expect(validShareToken('short')).toBe(false)
  })
  it('holds 0–72 hours, never past the booking cut-off', () => {
    const far = '2026-11-20T06:00:00Z'
    expect(holdUntil({ hours: 0, now, firstSessionAt: far, cutoffHours: 24 })).toBeNull()
    expect(holdUntil({ hours: 24, now, firstSessionAt: far, cutoffHours: 24 })?.toISOString()).toBe('2026-11-11T00:00:00.000Z')
    expect(holdUntil({ hours: 500, now, firstSessionAt: far, cutoffHours: 24 })?.toISOString()).toBe('2026-11-13T00:00:00.000Z')
    // Session in 2 days with a 24h cut-off: hold stops at the cut-off
    expect(holdUntil({ hours: 72, now, firstSessionAt: '2026-11-12T06:00:00Z', cutoffHours: 24 })?.toISOString()).toBe('2026-11-11T06:00:00.000Z')
    // Too close to bother holding
    expect(holdUntil({ hours: 24, now, firstSessionAt: '2026-11-11T00:10:00Z', cutoffHours: 24 })).toBeNull()
    expect(linkExpiry({ now, firstSessionAt: '2027-01-30T00:00:00Z', cutoffHours: 24 }).toISOString()).toBe('2026-11-24T00:00:00.000Z')
  })
  it('reports where a link is at', () => {
    expect(linkState({ status: 'active', holdUntil: '2026-11-11T00:00:00Z', holdActive: true, expiresAt: '2026-11-20T00:00:00Z' }, now)).toBe('held')
    expect(linkState({ status: 'active', holdUntil: '2026-11-09T00:00:00Z', holdActive: false, expiresAt: '2026-11-20T00:00:00Z' }, now)).toBe('open')
    expect(linkState({ status: 'active', expiresAt: '2026-11-09T00:00:00Z' }, now)).toBe('expired')
    expect(linkState({ status: 'booked' }, now)).toBe('booked')
  })
})
