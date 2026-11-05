import type { Payload } from 'payload'
import { accountMemberships } from './accounts'

export type Audience = 'everyone' | 'rowville' | 'rfa'

/** Which product audiences this user may see/buy: supporter gear for all, plus kit for their memberships. */
export async function allowedAudiences(payload: Payload, userId?: number | null): Promise<Audience[]> {
  const tags = await accountMemberships(payload, userId)
  return ['everyone', ...(tags.has('rowville') ? (['rowville'] as const) : []), ...(tags.has('rfa') ? (['rfa'] as const) : [])]
}
