'use server'

import { managementOrNull } from '@/lib/management'
import { payload } from '@/lib/payload'
import { sendBroadcast } from '@/messaging/broadcast'
import type { BroadcastState } from '@/app/(frontend)/coach/broadcast/actions'

/** Everyday notices from Management to a group, team or report round (not promotions — no marketing consent needed). */
export async function managementBroadcastAction(_prev: BroadcastState, fd: FormData): Promise<BroadcastState> {
  const user = await managementOrNull()
  if (!user) return { error: 'Management only — please log in again.' }
  if (fd.get('confirm') !== 'on') return { error: 'Tick the box to confirm who gets it.' }
  try {
    const r = await sendBroadcast(await payload(), user, null, String(fd.get('to') ?? ''), String(fd.get('body') ?? '').slice(0, 1200))
    return { done: `Sent to ${r.total} famil${r.total === 1 ? 'y' : 'ies'}: ${r.texted} texted, ${r.emailed} emailed${r.failed ? `, ${r.failed} not delivered` : ''}. Replies come to Management → Messages.` }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Couldn’t send — try again.' }
  }
}
