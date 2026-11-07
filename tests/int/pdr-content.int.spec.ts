import { describe, expect, it } from 'vitest'
import { AREAS, criteriaProblem, criteriaSummary, NAMED_BADGES, stageCode } from '@/academy/pdr/content'
import { PASSING_1_1 } from '@/academy/pdr/seed'

describe('PDR content rules', () => {
  it('has the six areas, Skills without a leaderboard', () => {
    expect(AREAS.map((a) => a.name)).toEqual(['Physical', 'Passing', 'Dribbling', 'Control', 'Skills', 'Ball Mastery'])
    expect(AREAS.filter((a) => !a.hasLeaderboard).map((a) => a.name)).toEqual(['Skills'])
  })
  it('codes stages as <area> <level>.<stage>', () => {
    expect(stageCode('Passing', 1, 1)).toBe('Passing 1.1')
    expect(stageCode('Ball Mastery', 3, 4)).toBe('Ball Mastery 3.4')
  })
  it('describes and validates pass criteria', () => {
    expect(criteriaSummary(PASSING_1_1.criteria)).toBe('30 passes in 30 seconds from 1 m')
    expect(criteriaProblem('scored', PASSING_1_1.criteria)).toBeNull()
    expect(criteriaProblem('scored', { target: 30, unit: '' })).toMatch(/unit/)
    expect(criteriaProblem('scored', { unit: 'passes' })).toMatch(/target/)
    expect(criteriaProblem('judged', {})).toBeNull()
  })
  it('names the two starting badges', () => {
    expect(NAMED_BADGES['physical:3']).toBe('Beast Mode')
    expect(NAMED_BADGES['dribbling:2']).toBe('Can’t Touch This')
  })
})
