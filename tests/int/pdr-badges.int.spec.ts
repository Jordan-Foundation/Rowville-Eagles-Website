import { describe, expect, it } from 'vitest'
import { badgeName, buildCabinet, levelComplete } from '@/academy/pdr/badges'

describe('Foundation+ badges', () => {
  it('a level is complete only when every stage is passed', () => {
    expect(levelComplete([1, 2, 3, 4], new Set([1, 2, 3, 4, 9]))).toBe(true)
    expect(levelComplete([1, 2, 3, 4], new Set([1, 2, 3]))).toBe(false)
    expect(levelComplete([], new Set([1]))).toBe(false)
  })
  it('placeholder badges get a friendly name for families', () => {
    expect(badgeName({ name: 'Beast Mode', placeholder: false })).toBe('Beast Mode')
    expect(badgeName({ name: 'PLACEHOLDER — Passing · Level 1', placeholder: true }, 'Passing', 1)).toBe('Passing Level 1 badge')
  })
  it('builds the cabinet by area and level, with earned dates', () => {
    const cab = buildCabinet({
      areas: [{ id: 2, name: 'Physical', slug: 'physical', order: 1, colour: '#f00' }, { id: 1, name: 'Passing', slug: 'passing', order: 2 }],
      levels: [{ id: 11, area: 1, number: 1 }, { id: 12, area: 1, number: 2 }, { id: 23, area: 2, number: 3 }],
      badges: [
        { id: 102, name: 'PLACEHOLDER', placeholder: true, howToEarn: null, type: 'level', level: 12, artworkUrl: null },
        { id: 101, name: 'PLACEHOLDER', placeholder: true, howToEarn: null, type: 'level', level: 11, artworkUrl: null },
        { id: 203, name: 'Beast Mode', placeholder: false, howToEarn: 'Pass every stage of Physical Level 3.', type: 'level', level: 23, artworkUrl: '/a.png' },
        { id: 900, name: 'November challenge', placeholder: false, howToEarn: null, type: 'monthly', level: null, artworkUrl: null },
      ],
      awards: [{ id: 5, badge: 101, awardedAt: '2026-11-07T00:00:00Z', celebratedAt: null }],
    })
    expect(cab.map((c) => c.area.name)).toEqual(['Physical', 'Passing'])
    expect(cab[0].badges[0]).toMatchObject({ name: 'Beast Mode', level: 3, earnedAt: null, artwork: '/a.png' })
    expect(cab[1].badges.map((b) => [b.name, b.level, Boolean(b.earnedAt), b.celebrated])).toEqual([['Passing Level 1 badge', 1, true, false], ['Passing Level 2 badge', 2, false, false]])
    expect(cab[1].badges[1].howToEarn).toBe('Pass every stage of Passing Level 2.')
  })
})
