import { redirect } from 'next/navigation'
import type { User } from '@/payload-types'
import { currentUser } from './auth'
import { homeFor, isManagementRoles } from './home'

/**
 * Gate for every /management page: Management (admin or committee) only. Logged out → login;
 * anyone else → their own home (coaches to the Coach dashboard, families to the player portal).
 */
export async function requireManagement(next = '/management'): Promise<User> {
  const user = await currentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`)
  if (!isManagementRoles(user.roles)) redirect(homeFor(user))
  return user
}

/** For server actions and route handlers: the Management user, or null. */
export async function managementOrNull(): Promise<User | null> {
  const user = await currentUser()
  return user && isManagementRoles(user.roles) ? user : null
}
