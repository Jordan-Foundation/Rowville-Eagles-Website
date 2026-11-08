'use server'

import { revalidatePath } from 'next/cache'
import { currentUser } from '@/lib/auth'
import { payload } from '@/lib/payload'
import { familyPost, MessageError } from '@/messaging/service'
import type { SendState } from '@/components/messaging/Thread'

export async function familySendAction(_prev: SendState, fd: FormData): Promise<SendState> {
  const user = await currentUser()
  if (!user) return { error: 'Please log in again.' }
  try {
    await familyPost(await payload(), user, String(fd.get('body') ?? ''))
  } catch (e) {
    if (e instanceof MessageError) return { error: e.message }
    throw e
  }
  revalidatePath('/account/messages')
  return { sent: 'Sent — your coach will reply here and by text.', key: Date.now() }
}
