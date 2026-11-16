'use server'

import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { managementOrNull } from '@/lib/management'
import { sendDigest } from '@/staff-feed/service'

/** Sends the summary of everything not yet summarised now (instead of waiting for 8pm). */
export async function sendSummaryNow() {
  const user = await managementOrNull()
  if (!user) redirect('/management/notifications?error=Management%20only.')
  const n = await sendDigest(await payload())
  redirect(`/management/notifications?${n ? `done=${encodeURIComponent(`Summary sent (${n} item${n === 1 ? '' : 's'}).`)}` : `error=${encodeURIComponent('Nothing new since the last summary.')}`}`)
}
