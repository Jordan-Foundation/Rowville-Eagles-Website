'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { coachOrNull } from '@/academy/portal'
import { saveSummary } from '@/academy/summaries/service'
import { removeSubscription, saveSubscription } from '@/push/send'
import { currentUser } from '@/lib/auth'

export type SummaryState = { error?: string }

/** Save one summary, then go to the next session waiting (or the "all done" screen). */
export async function saveSummaryAction(_prev: SummaryState, fd: FormData): Promise<SummaryState> {
  const me = await coachOrNull()
  if (!me) return { error: 'Please log in as a coach.' }
  const s = (k: string) => String(fd.get(k) ?? '')
  const effort = Number(fd.get('effort'))
  const playerNotes: Record<number, string> = {}
  for (const [k, v] of fd.entries()) if (k.startsWith('player-')) playerNotes[Number(k.slice(7))] = String(v)
  const r = await saveSummary(await payload(), me.user, me.coach, Number(fd.get('session')), {
    workedOn: fd.getAll('workedOn').map(String),
    wentWell: s('wentWell'),
    nextSteps: s('nextSteps'),
    homework: s('homework'),
    effort: effort >= 1 && effort <= 5 ? effort : null,
    privateNotes: s('privateNotes'),
    playerNotes,
  })
  if ('error' in r && r.error) return { error: r.error }
  revalidatePath('/coach', 'layout')
  const done = Number(fd.get('done') || 0) + 1
  redirect(`/coach/summaries?done=${done}&total=${fd.get('total') || ''}&skip=${encodeURIComponent(s('skip'))}`)
}

/** This phone turned notifications on/off. */
export async function savePushAction(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, device: string) {
  const u = await currentUser()
  if (!u) return { error: 'Please log in again.' }
  try {
    const p = await payload()
    await saveSubscription(p, u.id, sub, device)
    await (await import('@/lib/app-install')).recordAppStep(p, u.id, 'push')
    return { ok: true }
  } catch {
    return { error: 'Couldn’t turn on notifications on this device.' }
  }
}
export async function removePushAction(endpoint: string) {
  const u = await currentUser()
  if (u) await removeSubscription(await payload(), u.id, endpoint)
  return { ok: true }
}
