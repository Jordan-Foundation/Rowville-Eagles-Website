import type { Access, FieldAccess } from 'payload'

export type Role = 'admin' | 'committee' | 'coach' | 'parent' | 'player'

export type WithRoles = { roles?: Role[] | null } | null | undefined

export const hasRole = (user: WithRoles, ...roles: Role[]) =>
  Boolean(user?.roles?.some((r) => roles.includes(r)))

/** Club staff who manage content: admins and committee members. */
export const isStaff: Access = ({ req: { user } }) => hasRole(user as WithRoles, 'admin', 'committee')

export const isAdmin: Access = ({ req: { user } }) => hasRole(user as WithRoles, 'admin')

export const isAdminField: FieldAccess = ({ req: { user } }) => hasRole(user as WithRoles, 'admin')

export const anyone: Access = () => true

/** Published content is public; drafts/hidden only visible to staff. */
export const publishedOrStaff =
  (field = 'status', publicValues: string[] = ['published']): Access =>
  ({ req: { user } }) => {
    if (hasRole(user as WithRoles, 'admin', 'committee')) return true
    return { [field]: { in: publicValues } }
  }

/** Staff see everything; account holders see only their own records. */
export const staffOrOwner =
  (ownerField = 'account'): Access =>
  ({ req: { user } }) => {
    if (!user) return false
    if (hasRole(user as WithRoles, 'admin', 'committee')) return true
    return { [ownerField]: { equals: user.id } }
  }
