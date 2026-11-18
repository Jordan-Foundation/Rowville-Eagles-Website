'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { managementOrNull } from '@/lib/management'
import { sendTrialInvites } from '@/lib/trials'

/** Management pressed Send on the preview: email + text the trial dates to everyone listed (or the ticked ones). */
export async function sendInvitesAction(fd: FormData) {
  const me = await managementOrNull()
  if (!me) redirect('/login?next=/management/selections/trial-invites')
  const ids = fd.getAll('id').map(Number).filter(Boolean)
  const { sent } = await sendTrialInvites(await payload(), { ids })
  revalidatePath('/management', 'layout')
  redirect(`/management/selections/trial-invites?sent=${sent}`)
}
