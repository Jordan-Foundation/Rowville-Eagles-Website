import { describe, expect, it } from 'vitest'
import { bestPerPlayer, displayName, rank, standing, standingText, validDisplayName } from '@/academy/pdr/leaderboard'

describe('Foundation+ leaderboards', () => {
  it('shows first name and last initial unless a display name is chosen', () => {
    expect(displayName({ firstName: 'Mia', lastName: 'thompson' })).toBe('Mia T.')
    expect(displayName({ firstName: 'Mia', lastName: 'Thompson', pdr: { leaderboardName: 'Mighty Mia' } })).toBe('Mighty Mia')
    expect(validDisplayName('Mighty Mia')).toBe(true)
    expect(validDisplayName('x')).toBe(false)
    expect(validDisplayName('call me 0412345678')).toBe(false)
  })
  it('keeps each player’s best score in the right direction', () => {
    const e = [{ player: 1, value: 30 }, { player: 1, value: 34 }, { player: 2, value: 20 }, { player: 2, value: 18 }]
    expect(bestPerPlayer(e, 'higher').map((x) => x.value).sort()).toEqual([20, 34])
    expect(bestPerPlayer(e, 'lower').map((x) => x.value).sort()).toEqual([18, 30])
  })
  it('ranks with shared places for ties (higher and lower is better)', () => {
    const e = [{ player: 1, value: 30, at: '2026-11-02' }, { player: 2, value: 34 }, { player: 3, value: 30, at: '2026-11-01' }, { player: 4, value: 25 }]
    expect(rank(e, 'higher').map((r) => [r.player, r.rank])).toEqual([[2, 1], [3, 2], [1, 2], [4, 4]])
    expect(rank(e, 'lower').map((r) => [r.player, r.rank])).toEqual([[4, 1], [3, 2], [1, 2], [2, 4]])
  })
  it('works out standings once enough players have passed', () => {
    const all = [30, 31, 32, 33, 34, 35, 36, 37, 38, 39]
    expect(standing(38, all, 'higher', 5)).toMatchObject({ position: 2, total: 10, topPct: 20, beatPct: 89 })
    expect(standing(38, all.slice(0, 4), 'higher', 5)).toBeNull()
    expect(standingText(standing(38, all, 'higher', 5)!, { unit: 'passes', direction: 'higher' })).toBe('Top 20% · better than 89% of players')
    expect(standingText(standing(12.5, [12.5, 13, 14, 15, 16, 20], 'lower', 5)!, { unit: 'seconds', direction: 'lower' })).toBe('#1 of 6 players')
    expect(standingText(standing(16, [12.5, 13, 14, 15, 16, 20], 'lower', 5)!, { unit: 'seconds', direction: 'lower' })).toBe('Faster than 20% of players')
  })
})
