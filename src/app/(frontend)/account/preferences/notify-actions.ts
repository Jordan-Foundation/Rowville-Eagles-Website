'use server'

import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { NOTIFY_TYPES } from '@/lib/app-install'

/** Turn individual phone notification types on or off. */
export async function saveNotifyTypes(fd: FormData) {
  const u = await currentUser()
  if (!u) redirect('/login?next=/account/preferences')
  const on = new Set(fd.getAll('notify').map(String))
  const notify = Object.fromEntries(NOTIFY_TYPES.map((t) => [t.key, on.has(t.key)]))
  await (await payload()).update({ collection: 'users', id: u.id, data: { notify }, overrideAccess: true, context: { skipWelcome: true } })
  redirect('/account/preferences?saved=notify#notifications')
}
