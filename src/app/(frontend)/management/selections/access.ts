import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import { hasRole } from '@/access'

/** Admins, committee and coaches can run selections. */
export async function requireSelector(next: string) {
  const user = await currentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`)
  if (!hasRole(user, 'admin', 'committee', 'coach')) redirect('/account')
  return user
}

export async function selectorOrNull() {
  const user = await currentUser()
  return user && hasRole(user, 'admin', 'committee', 'coach') ? user : null
}
