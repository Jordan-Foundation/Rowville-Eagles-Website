'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { hasRole } from '@/access'

export async function toggleSetupItem(key: string, done: boolean) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user || user.collection !== 'users' || !hasRole(user as never, 'admin', 'committee')) return { error: 'Admins only' }
  if (!/^[a-z0-9-]{2,40}$/.test(key)) return { error: 'Bad item' }
  const g = await payload.findGlobal({ slug: 'setup-progress', depth: 0, overrideAccess: true })
  const ticked = { ...((g.ticked as Record<string, boolean>) ?? {}), [key]: done }
  await payload.updateGlobal({ slug: 'setup-progress', overrideAccess: true, data: { ticked } })
  revalidatePath('/admin/setup')
  return { ok: true }
}
