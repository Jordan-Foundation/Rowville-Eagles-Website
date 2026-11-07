import type { Payload } from 'payload'
import { currentSeason, DEFAULT_RULES, type AgeRules } from './age-groups'

/** The season and MiniRoos rules from Site settings (server only). Pass the result to client components. */
export async function getAgeRules(payload: Payload): Promise<AgeRules> {
  const s = await payload.findGlobal({ slug: 'site-settings', depth: 0 })
  const g = (s as { ageGroups?: Partial<AgeRules> | null }).ageGroups ?? {}
  return {
    season: currentSeason(s.season),
    miniMin: g.miniMin ?? DEFAULT_RULES.miniMin,
    miniMax: g.miniMax ?? DEFAULT_RULES.miniMax,
    maxDown: g.maxDown ?? DEFAULT_RULES.maxDown,
    warnDown: g.warnDown ?? DEFAULT_RULES.warnDown,
  }
}
