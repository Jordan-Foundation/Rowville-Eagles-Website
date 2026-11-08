'use server'

import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { hasRole } from '@/access'
import { sendConsentReviewBatch } from '@/lib/consent-review'

export type BatchState = { sent?: number; error?: string }

export async function sendBatch(_prev: BatchState): Promise<BatchState> {
  const user = await currentUser()
  if (!user || !hasRole(user, 'admin')) return { error: 'Only admins can send this.' }
  const result = await sendConsentReviewBatch(await payload(), 100)
  revalidatePath('/management/consent')
  return result
}
