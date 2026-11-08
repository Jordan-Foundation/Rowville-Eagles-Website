'use server'

import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { hasRole } from '@/access'

export async function toggleArchive(fd: FormData) {
  const user = await currentUser()
  if (!user || !hasRole(user, 'admin', 'committee')) return
  const p = await payload()
  const team = await p.findByID({ collection: 'teams', id: Number(fd.get('id')), depth: 0, overrideAccess: true, disableErrors: true })
  if (!team) return
  await p.update({ collection: 'teams', id: team.id, overrideAccess: true, data: { archived: !team.archived } })
  revalidatePath('/management/teams')
}
