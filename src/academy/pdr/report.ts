/**
 * Foundation+ report logic (pure — unit tested).
 *  - Level 1 of every area is open; Level N+1 opens when every stage of Level N in that area is passed.
 *  - Areas progress independently.
 *  - Plans: Free = Level 1 only; Standard and Premium = every level. Progress is kept on downgrade.
 *  - Stages not yet published show as "coming soon" and still count towards finishing a level.
 */
export type Tier = 'free' | 'standard' | 'premium'
export type AreaLite = { id: number; name: string; slug: string; order?: number | null; colour?: string | null; hasLeaderboard?: boolean | null }
export type LevelLite = { id: number; area: number; number: number; title?: string | null }
export type StageLite = { id: number; area: number; levelNumber: number; stageNumber: number; code: string; skillName: string; published?: boolean | null; placeholder?: boolean | null }
export type ProgressLite = { stage: number; method: 'verified' | 'promoted'; score?: number | null; passedAt?: string | null }

export type StageStatus = 'passed_verified' | 'passed_promoted' | 'not_started' | 'locked' | 'coming_soon'
export const STATUS_LABEL: Record<StageStatus, string> = {
  passed_verified: 'Passed (verified)',
  passed_promoted: 'Passed (coach-promoted)',
  not_started: 'Not started',
  locked: 'Locked',
  coming_soon: 'Coming soon',
}

export const tierAllowsLevel = (tier: Tier, level: number) => level <= 1 || tier !== 'free'
export const TIER_LABEL: Record<Tier, string> = { free: 'Free', standard: 'Standard', premium: 'Premium' }

export type LevelReport = {
  level: LevelLite
  /** Opened by progress (previous level complete) */
  unlocked: boolean
  /** Opened by progress but needs a paid plan */
  tierLocked: boolean
  available: boolean
  lockMessage: string | null
  passed: number
  total: number
  complete: boolean
  stages: { stage: StageLite; status: StageStatus; progress: ProgressLite | null }[]
}
export type AreaReport = { area: AreaLite; levels: LevelReport[]; current: LevelReport | null; passed: number; total: number; percent: number; finished: boolean }

export function buildReport(o: { areas: AreaLite[]; levels: LevelLite[]; stages: StageLite[]; progress: ProgressLite[]; tier: Tier }): AreaReport[] {
  const done = new Map(o.progress.map((p) => [p.stage, p]))
  return [...o.areas]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((area) => {
      const levels = o.levels.filter((l) => l.area === area.id).sort((a, b) => a.number - b.number)
      const out: LevelReport[] = []
      let previousComplete: boolean = true
      let previous: LevelLite | null = null
      for (const level of levels) {
        const stages = o.stages.filter((s) => s.area === area.id && s.levelNumber === level.number).sort((a, b) => a.stageNumber - b.stageNumber)
        const unlocked: boolean = level.number === 1 || previousComplete
        const tierLocked: boolean = unlocked && !tierAllowsLevel(o.tier, level.number)
        const available: boolean = unlocked && !tierLocked
        const rows: LevelReport['stages'] = stages.map((stage) => {
          const p = done.get(stage.id) ?? null
          const status: StageStatus = p
            ? p.method === 'promoted'
              ? 'passed_promoted'
              : 'passed_verified'
            : !stage.published || stage.placeholder
              ? 'coming_soon'
              : available
                ? 'not_started'
                : 'locked'
          return { stage, status, progress: p }
        })
        const passed: number = rows.filter((r) => r.progress).length
        const complete: boolean = stages.length > 0 && passed === stages.length
        out.push({
          level,
          unlocked,
          tierLocked,
          available,
          lockMessage: !unlocked
            ? `Complete all Level ${previous!.number} ${area.name} stages to unlock.`
            : tierLocked
              ? `Level ${level.number} and above are part of Standard and Premium — upgrade to unlock.`
              : null,
          passed,
          total: stages.length,
          complete,
          stages: rows,
        })
        previousComplete = complete
        previous = level
      }
      const passed = out.reduce((n, l) => n + l.passed, 0)
      const total = out.reduce((n, l) => n + l.total, 0)
      const current = out.find((l) => l.unlocked && !l.complete) ?? out.at(-1) ?? null
      return { area, levels: out, current, passed, total, percent: total ? Math.round((passed / total) * 100) : 0, finished: out.length > 0 && out.every((l) => l.complete) }
    })
}

/** URL piece for a stage: "Passing 1.2" → "1-2" */
export const stageSlug = (s: Pick<StageLite, 'levelNumber' | 'stageNumber'>) => `${s.levelNumber}-${s.stageNumber}`
