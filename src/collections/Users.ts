import type { CollectionConfig } from 'payload'
import { hasRole, isAdminField } from '../access'

/**
 * One account type for everyone: committee, coaches, parents and adult players.
 * Junior players are NOT accounts — they are Participants owned by a parent/guardian
 * (see Participants) to meet Child Safe Standards and privacy obligations.
 */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'firstName', 'lastName', 'roles'],
    group: 'People',
  },
  auth: { tokenExpiration: 60 * 60 * 24 * 14, cookies: { sameSite: 'Lax' } },
  hooks: {
    afterLogin: [
      async ({ user, req }) => {
        if (!user.activated) await req.payload.update({ collection: 'users', id: user.id, data: { activated: true }, overrideAccess: true })
      },
    ],
  },
  access: {
    admin: ({ req: { user } }) => hasRole(user as never, 'admin', 'committee', 'coach'),
    read: ({ req: { user } }) => {
      if (!user) return false
      if (hasRole(user as never, 'admin', 'committee')) return true
      return { id: { equals: user.id } }
    },
    create: () => true, // public sign-up for parents/players
    update: ({ req: { user } }) => {
      if (!user) return false
      if (hasRole(user as never, 'admin')) return true
      return { id: { equals: user.id } }
    },
    delete: ({ req: { user } }) => hasRole(user as never, 'admin'),
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'firstName', type: 'text' },
        { name: 'lastName', type: 'text' },
      ],
    },
    { name: 'phone', type: 'text' },
    {
      name: 'activated',
      type: 'checkbox',
      defaultValue: false,
      admin: { readOnly: true, position: 'sidebar', description: 'Has set their own password / logged in' },
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      defaultValue: ['parent'],
      saveToJWT: true,
      access: { create: isAdminField, update: isAdminField },
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Committee', value: 'committee' },
        { label: 'Coach', value: 'coach' },
        { label: 'Parent / Guardian', value: 'parent' },
        { label: 'Player (18+)', value: 'player' },
      ],
    },
    {
      name: 'wwcc',
      label: 'Working With Children Check',
      type: 'group',
      admin: { condition: (data) => data?.roles?.includes('coach') },
      access: { read: isAdminField, update: isAdminField },
      fields: [
        { name: 'number', type: 'text' },
        { name: 'expiry', type: 'date' },
      ],
    },
  ],
}
