import { describe, expect, it } from 'vitest'
import { coachStatus, wwccProblem } from '@/lib/coach-signup'

const today = '2026-11-17'
const w = (o = {}) => ({ number: '1234567A-01', expiry: '2029-05-01T02:00:00.000Z', photo: 5, submittedAt: '2026-11-17T01:00:00Z', checkedAt: null, ...o })

describe('coach sign-up status', () => {
  it('follows a coach from invite to ready', () => {
    expect(coachStatus({ activated: false }, today)).toBe('not-invited')
    expect(coachStatus({ activated: false, coachInvitedAt: '2026-11-16T00:00:00Z' }, today)).toBe('invited')
    expect(coachStatus({ activated: true, wwcc: {} }, today)).toBe('wwcc-needed')
    expect(coachStatus({ activated: true, wwcc: w({ photo: null }) }, today)).toBe('wwcc-needed')
    expect(coachStatus({ activated: true, wwcc: w() }, today)).toBe('to-check')
    expect(coachStatus({ activated: true, wwcc: w({ checkedAt: '2026-11-17T02:00:00Z' }) }, today)).toBe('ready')
  })
  it('flags expired and soon-to-expire cards', () => {
    expect(coachStatus({ activated: true, wwcc: w({ expiry: '2026-11-10T01:00:00Z', checkedAt: '2025-01-01' }) }, today)).toBe('expired')
    expect(coachStatus({ activated: true, wwcc: w({ expiry: '2026-12-10T01:00:00Z', checkedAt: '2025-01-01' }) }, today)).toBe('expiring')
  })
  it('validates the WWCC the coach enters', () => {
    expect(wwccProblem('1234567A-01', '2029-01-01', today, true)).toBeNull()
    expect(wwccProblem('12', '2029-01-01', today, true)).toMatch(/card number/)
    expect(wwccProblem('1234567A-01', '', today, true)).toMatch(/expiry/)
    expect(wwccProblem('1234567A-01', '2026-01-01', today, true)).toMatch(/expired/)
    expect(wwccProblem('1234567A-01', '2029-01-01', today, false)).toMatch(/photo/)
  })
})
