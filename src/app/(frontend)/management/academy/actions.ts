'use server'

import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { hasRole } from '@/access'
import { sendAvailabilityReminders } from '@/academy/reminders'

export type RunState = { sent?: number; error?: string }

export async function runRemindersNow(_prev: RunState): Promise<RunState> {
  const user = await currentUser()
  if (!user || !hasRole(user, 'admin', 'committee')) return { error: 'Management only.' }
  const { sent } = await sendAvailabilityReminders(await payload())
  revalidatePath('/management/academy')
  return { sent }
}
