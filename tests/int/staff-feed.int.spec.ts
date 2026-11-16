import { describe, expect, it } from 'vitest'
import { became, digestDue, groupForDigest, isQuiet, isSoon, morningText, urgentText } from '@/staff-feed/rules'

describe('staff notifications', () => {
  it('quiet hours are 9pm–7am', () => {
    expect([20, 21, 23, 0, 6, 7, 12].map(isQuiet)).toEqual([false, true, true, true, true, false, false])
  })
  it('soon = within the next 48 hours', () => {
    const now = new Date('2026-11-16T00:00:00Z')
    expect(isSoon('2026-11-17T23:00:00Z', now)).toBe(true)
    expect(isSoon('2026-11-18T01:00:00Z', now)).toBe(false)
    expect(isSoon('2026-11-15T23:30:00Z', now)).toBe(true) // just started
    expect(isSoon('2026-11-14T00:00:00Z', now)).toBe(false)
    expect(isSoon(null, now)).toBe(false)
  })
  it('fires only when a status changes into the watched value', () => {
    expect(became({ status: 'pending' }, { status: 'paid' }, 'paid')).toBe(true)
    expect(became({ status: 'paid' }, { status: 'paid' }, 'paid')).toBe(false)
    expect(became(null, { status: 'paid' }, 'paid')).toBe(true)
    expect(became({ status: 'paid' }, { status: 'refunded' }, ['cancelled', 'refunded'])).toBe(true)
  })
  it('digest sections in a fixed order, problems first, empty ones left out', () => {
    const g = groupForDigest([{ kind: 'payment' }, { kind: 'problem' }, { kind: 'payment' }, { kind: 'trial' }] as { kind: 'payment' | 'problem' | 'trial' }[])
    expect(g.map((x) => [x.title, x.items.length])).toEqual([['Needs attention', 1], ['Trial sign-ups', 1], ['Payments', 2]])
  })
  it('texts are short; the morning bundle lists 4 then a count', () => {
    expect(urgentText({ kind: 'problem', title: 'Cover needed', detail: 'Tue 5pm' }, 'https://x/y')).toBe('Cover needed — Tue 5pm. https://x/y')
    const t = morningText(Array.from({ length: 6 }, (_, i) => ({ kind: 'trial' as const, title: `Trial ${i}` })), 'L')
    expect(t.startsWith('Overnight (6):')).toBe(true)
    expect(t).toContain('• Trial 3')
    expect(t).not.toContain('• Trial 4')
    expect(t).toContain('+2 more')
  })
  it('digest goes once a day from 8pm', () => {
    expect(digestDue(19, '2026-11-16', null)).toBe(false)
    expect(digestDue(20, '2026-11-16', '2026-11-15')).toBe(true)
    expect(digestDue(22, '2026-11-16', '2026-11-16')).toBe(false)
  })
})
