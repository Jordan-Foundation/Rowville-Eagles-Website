import type { SelectionRound } from '@/payload-types'
import { payload } from '@/lib/payload'
import { kindOf, type ProgramKey } from '@/selections/flow'
import { roundsFor } from '@/selections/v2'

export type Search = { program?: string; round?: string; age?: string; q?: string; session?: string; stage?: string; view?: string; done?: string; error?: string }

/** Program (Eagles / RFA), its rounds, the chosen round (newest by default) and the age group filter. */
export async function selectionContext(sp: Search) {
  const p = await payload()
  const program: ProgramKey = sp.program === 'rfa' ? 'rfa' : 'eagles'
  const rounds = await roundsFor(p, kindOf(program))
  const round: SelectionRound | null = rounds.find((r) => String(r.id) === sp.round) ?? rounds[0] ?? null
  const age = Number(sp.age) || null
  return { p, program, rounds, round, age }
}

/** Build a link keeping the current filters. */
export function href(path: string, keep: Record<string, string | number | null | undefined>) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(keep)) if (v !== null && v !== undefined && v !== '') qs.set(k, String(v))
  const s = qs.toString()
  return s ? `${path}?${s}` : path
}
