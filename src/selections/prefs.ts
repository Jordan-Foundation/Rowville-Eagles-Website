import type { Payload } from 'payload'
import type { SelectionEntry, Squad } from '@/payload-types'
import { prefsEditable } from './flow'

/**
 * The training nights / game day survey after an Eagles registration is paid. Families can change their answers
 * until their team is finalised; until they answer it shows as a task on their homepage.
 */
const q = { overrideAccess: true } as const

export const surveyHref = (ref: string) => `/account/selections/${encodeURIComponent(ref)}/preferences`

/** Paid Eagles registrations on this account still waiting for an answer (and whose team isn't finalised). */
export async function pendingSurveys(p: Payload, accountId: number) {
  const { docs } = await p.find({ collection: 'selection-entries', where: { account: { equals: accountId }, kind: { equals: 'rowville' }, status: { equals: 'registered' }, 'prefs.answeredAt': { exists: false } }, limit: 20, depth: 1, ...q, pagination: false })
  return docs.filter((e) => prefsEditable(e.squad && typeof e.squad === 'object' ? (e.squad as Squad) : null)).map((e) => ({ ref: e.reference!, name: e.player.firstName, participant: typeof e.participant === 'object' ? e.participant?.id : e.participant }))
}

/** The survey for a player who has just paid (by player). */
export async function pendingSurveyFor(p: Payload, accountId: number, participantId: number) {
  return (await pendingSurveys(p, accountId)).find((s) => s.participant === participantId) ?? null
}

export async function entryForFamily(p: Payload, ref: string, accountId: number): Promise<SelectionEntry | null> {
  const { docs } = await p.find({ collection: 'selection-entries', where: { reference: { equals: ref } }, limit: 1, depth: 1, ...q })
  const e = docs[0]
  if (!e || (typeof e.account === 'object' ? e.account?.id : e.account) !== accountId) return null
  return e
}
