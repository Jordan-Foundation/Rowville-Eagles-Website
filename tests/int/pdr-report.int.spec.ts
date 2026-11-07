import { describe, expect, it } from 'vitest'
import { buildReport, tierAllowsLevel, type LevelLite, type StageLite } from '@/academy/pdr/report'

const areas = [
  { id: 1, name: 'Passing', slug: 'passing', order: 2 },
  { id: 2, name: 'Physical', slug: 'physical', order: 1 },
]
const levels: LevelLite[] = [1, 2].flatMap((a) => [1, 2, 3].map((n) => ({ id: a * 10 + n, area: a, number: n })))
let id = 100
const stages: StageLite[] = [1, 2].flatMap((a) =>
  [1, 2, 3].flatMap((l) => [1, 2, 3, 4].map((s) => ({ id: id++, area: a, levelNumber: l, stageNumber: s, code: `${a} ${l}.${s}`, skillName: 'x', published: true, placeholder: false }))),
)
const st = (a: number, l: number, s: number) => stages.find((x) => x.area === a && x.levelNumber === l && x.stageNumber === s)!
const pass = (a: number, l: number, ss: number[], method: 'verified' | 'promoted' = 'verified') => ss.map((s) => ({ stage: st(a, l, s).id, method }))

describe('Foundation+ unlocking', () => {
  it('opens Level 1 only at the start, in any order', () => {
    const r = buildReport({ areas, levels, stages, progress: pass(1, 1, [3]), tier: 'standard' })
    const passing = r.find((a) => a.area.slug === 'passing')!
    expect(r[0].area.slug).toBe('physical') // sorted by order
    expect(passing.levels[0].stages.map((s) => s.status)).toEqual(['not_started', 'not_started', 'passed_verified', 'not_started'])
    expect(passing.levels[1]).toMatchObject({ unlocked: false, lockMessage: 'Complete all Level 1 Passing stages to unlock.' })
    expect(passing.levels[1].stages[0].status).toBe('locked')
    expect(passing.current?.level.number).toBe(1)
  })
  it('unlocks the next level when all four are passed (promotions count), per area', () => {
    const r = buildReport({ areas, levels, stages, progress: [...pass(1, 1, [1, 2]), ...pass(1, 1, [3, 4], 'promoted')], tier: 'standard' })
    const passing = r.find((a) => a.area.slug === 'passing')!
    expect(passing.levels[0].complete).toBe(true)
    expect(passing.levels[1]).toMatchObject({ unlocked: true, available: true })
    expect(passing.levels[2].unlocked).toBe(false)
    expect(passing.current?.level.number).toBe(2)
    expect(passing).toMatchObject({ passed: 4, total: 12, percent: 33 })
    expect(r.find((a) => a.area.slug === 'physical')!.levels[1].unlocked).toBe(false)
  })
  it('Free plan: Level 2 unlocked by progress is still locked behind a plan, progress kept', () => {
    const r = buildReport({ areas, levels, stages, progress: [...pass(1, 1, [1, 2, 3, 4]), ...pass(1, 2, [1])], tier: 'free' })
    const l2 = r.find((a) => a.area.slug === 'passing')!.levels[1]
    expect(l2).toMatchObject({ unlocked: true, tierLocked: true, available: false })
    expect(l2.lockMessage).toMatch(/upgrade/)
    expect(l2.stages.map((s) => s.status)).toEqual(['passed_verified', 'locked', 'locked', 'locked'])
    expect(tierAllowsLevel('free', 1)).toBe(true)
    expect(tierAllowsLevel('premium', 3)).toBe(true)
  })
  it('unwritten stages are coming soon and keep the next level locked', () => {
    const s2 = stages.map((s) => (s.area === 1 && s.levelNumber === 1 && s.stageNumber === 4 ? { ...s, published: false, placeholder: true } : s))
    const r = buildReport({ areas, levels, stages: s2, progress: pass(1, 1, [1, 2, 3]), tier: 'premium' })
    const passing = r.find((a) => a.area.slug === 'passing')!
    expect(passing.levels[0].stages[3].status).toBe('coming_soon')
    expect(passing.levels[1].unlocked).toBe(false)
  })
  it('a finished area reports its last level as current', () => {
    const all = [1, 2, 3].flatMap((l) => pass(2, l, [1, 2, 3, 4]))
    const phys = buildReport({ areas, levels, stages, progress: all, tier: 'premium' }).find((a) => a.area.slug === 'physical')!
    expect(phys).toMatchObject({ finished: true, percent: 100 })
    expect(phys.current?.level.number).toBe(3)
  })
})
