import { describe, expect, it } from 'vitest'
import { canEnterChallenge, challengeResults, challengeState, daysLeft, monthKey, monthLabel, validMonth } from '@/academy/pdr/challenge-rules'

describe('monthly challenges', () => {
  it('runs for one Melbourne calendar month', () => {
    // 30 Nov 14:30 UTC is already 1 Dec in Melbourne (UTC+11)
    const now = new Date('2026-11-30T14:30:00Z')
    expect(monthKey(now)).toBe('2026-12')
    expect(challengeState('2026-12', now)).toBe('open')
    expect(challengeState('2026-11', now)).toBe('closed')
    expect(challengeState('2027-01', now)).toBe('upcoming')
    expect(daysLeft('2026-12', now)).toBe(31)
    expect(daysLeft('2026-12', new Date('2026-12-31T01:00:00Z'))).toBe(1)
    expect(monthLabel('2026-12')).toBe('December 2026')
    expect(validMonth('2026-13')).toBe(false)
  })
  it('only Premium players can enter while it is open, one attempt waiting at a time', () => {
    const base = { state: 'open' as const, tier: 'premium' as const, pending: 0, published: true }
    expect(canEnterChallenge(base)).toEqual({ ok: true })
    expect(canEnterChallenge({ ...base, tier: 'standard' })).toMatchObject({ ok: false })
    expect(canEnterChallenge({ ...base, pending: 1 })).toMatchObject({ ok: false })
    expect(canEnterChallenge({ ...base, state: 'closed' })).toMatchObject({ ok: false, reason: 'This challenge has finished.' })
    expect(canEnterChallenge({ ...base, published: false })).toMatchObject({ ok: false })
  })
  it('best score per player, ranked by year of birth; ties share a win', () => {
    const years: Record<number, string> = { 1: '2016', 2: '2016', 3: '2016', 4: '2017', 5: '2017' }
    const r = challengeResults(
      [
        { player: 1, value: 40, at: '2026-12-02' },
        { player: 1, value: 55, at: '2026-12-09' },
        { player: 2, value: 55, at: '2026-12-03' },
        { player: 3, value: 30, at: '2026-12-01' },
        { player: 4, value: 12, at: '2026-12-05' },
        { player: 5, value: 9, at: '2026-12-06' },
        { player: 6, value: 99, at: '2026-12-06' }, // no group → left out
      ],
      (id) => years[id] ?? null,
      'higher',
      1,
    )
    expect(r.filter((x) => x.winner).map((x) => x.player).sort()).toEqual([1, 2, 4])
    expect(r.find((x) => x.player === 3)).toMatchObject({ rank: 3, winner: false })
    expect(r.some((x) => x.player === 6)).toBe(false)
    // lower is better (e.g. seconds)
    const t = challengeResults([{ player: 4, value: 12 }, { player: 5, value: 9 }], () => 'all', 'lower', 1)
    expect(t[0]).toMatchObject({ player: 5, winner: true })
  })
})
