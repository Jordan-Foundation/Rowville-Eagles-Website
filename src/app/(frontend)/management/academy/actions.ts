'use server'

import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { hasRole } from '@/access'
import { sendAvailabilityReminders } from '@/academy/reminders'

export type RunState = { sent?: number; error?: string }

/** Cover list: ask a coach to cover a 1-on-1 (they get an email + text to confirm or decline). */
export async function askCoverAction(fd: FormData) {
  const user = await currentUser()
  if (!hasRole(user, 'admin', 'committee')) return
  const p = await payload()
  const sessionId = Number(fd.get('session'))
  const coachId = Number(fd.get('coach'))
  if (!sessionId || !coachId) return
  await p.update({ collection: 'academy-sessions', id: sessionId, overrideAccess: true, data: { coverCoach: coachId, coverStatus: null } })
  revalidatePath('/management/academy')
}

export async function runRemindersNow(_prev: RunState): Promise<RunState> {
  const user = await currentUser()
  if (!user || !hasRole(user, 'admin', 'committee')) return { error: 'Management only.' }
  const { sent } = await sendAvailabilityReminders(await payload())
  revalidatePath('/management/academy')
  return { sent }
}
