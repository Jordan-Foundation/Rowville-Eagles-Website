import type { Role } from '../access'

/** Management = admin or committee (the internal role names are unchanged). */
export const isManagementRoles = (roles: readonly string[] | null | undefined) => Boolean(roles?.some((r) => r === 'admin' || r === 'committee'))
export const isCoachRoles = (roles: readonly string[] | null | undefined) => Boolean(roles?.includes('coach'))

/**
 * Where "My account" takes someone: Management → Management dashboard, coaches → Coach dashboard,
 * everyone else (parents, players) → the player portal. Someone with both goes to Management.
 */
export function homeFor(user: { roles?: readonly (Role | string)[] | null } | null | undefined) {
  if (!user) return '/login'
  if (isManagementRoles(user.roles)) return '/management'
  if (isCoachRoles(user.roles)) return '/coach'
  return '/account'
}
