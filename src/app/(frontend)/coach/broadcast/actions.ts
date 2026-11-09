'use server'

import { coachOrNull } from '@/academy/portal'
import { payload } from '@/lib/payload'
import { sendBroadcast } from '@/messaging/broadcast'

export type BroadcastState = { error?: string; done?: string }

export async function broadcastAction(_prev: BroadcastState, fd: FormData): Promise<BroadcastState> {
  const c = await coachOrNull()
  if (!c) return { error: 'Please log in again.' }
  if (fd.get('confirm') !== 'on') return { error: 'Tick the box to confirm who gets it.' }
  try {
    const r = await sendBroadcast(await payload(), c.user, c.coach, String(fd.get('to') ?? ''), String(fd.get('body') ?? '').slice(0, 1200))
    return { done: `Sent to ${r.total} famil${r.total === 1 ? 'y' : 'ies'}: ${r.texted} texted, ${r.emailed} emailed${r.failed ? `, ${r.failed} not delivered` : ''}. Replies come to your Messages.` }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Couldn’t send — try again.' }
  }
}
