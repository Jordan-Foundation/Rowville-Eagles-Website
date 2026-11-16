'use server'

import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { addFeedback } from '@/reflections/service'

export type FeedbackState = { ok?: boolean; error?: string }

/** 👍 Seen (empty comment) or Seen + a short comment the family can read. */
export async function feedbackAction(_prev: FeedbackState, fd: FormData): Promise<FeedbackState> {
  const user = await currentUser()
  if (!user) return { error: 'Please log in again.' }
  try {
    await addFeedback(await payload(), Number(fd.get('reflection')), user, String(fd.get('comment') ?? ''))
    revalidatePath('/coach/reflections', 'layout')
    revalidatePath('/management/reflections')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not save.' }
  }
}
