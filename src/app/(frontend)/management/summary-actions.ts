'use server'

import { managementOrNull } from '@/lib/management'
import { payload } from '@/lib/payload'
import { sendWeeklySummary } from '@/lib/weekly-summary'

export type SummaryState = { done?: string; error?: string }

/** "Email me this summary": the Monday email, now, to just the person asking. */
export async function emailMeSummary(_prev: SummaryState): Promise<SummaryState> {
  const user = await managementOrNull()
  if (!user) return { error: 'Please log in again.' }
  await sendWeeklySummary(await payload(), { force: true, only: user.id })
  return { done: `Sent to ${user.email}. It also arrives every Monday morning.` }
}
