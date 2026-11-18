'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { coachOrNull } from '@/academy/portal'
import { SelectionError, saveWelcome } from '@/selections/v2'

/** A coach saves the welcome message for their own team (it goes in the team email). */
export async function saveWelcomeAction(fd: FormData) {
  const me = await coachOrNull()
  if (!me) redirect('/login?next=/coach/team-welcome')
  const squad = Number(fd.get('squad'))
  try {
    await saveWelcome(await payload(), { squad, message: String(fd.get('message') ?? ''), by: me.user, asManagement: false })
  } catch (e) {
    redirect(`/coach/team-welcome?error=${encodeURIComponent(e instanceof SelectionError ? e.message : 'Couldn’t save — please try again.')}`)
  }
  revalidatePath('/coach', 'layout')
  redirect(`/coach/team-welcome?saved=${squad}`)
}
