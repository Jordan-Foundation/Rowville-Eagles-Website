'use server'

import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { coachOrNull } from '@/academy/portal'
import { saveWwcc } from '@/lib/coach-signup'
import { wwccFromForm } from '@/lib/coach-signup-form'

export type WwccState = { error?: string; saved?: boolean }

/** A coach adds or renews their Working With Children Check from their profile. */
export async function saveMyWwcc(_prev: WwccState, fd: FormData): Promise<WwccState> {
  const me = await coachOrNull()
  if (!me) return { error: 'Please log in as a coach.' }
  const w = await wwccFromForm(fd)
  if ('error' in w) return { error: w.error }
  try {
    await saveWwcc(await payload(), me.user, w)
  } catch {
    return { error: 'We couldn’t read that card photo — please try a clearer photo (JPG or PNG) or a PDF.' }
  }
  revalidatePath('/coach', 'layout')
  return { saved: true }
}
