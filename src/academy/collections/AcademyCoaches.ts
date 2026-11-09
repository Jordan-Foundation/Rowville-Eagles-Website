import type { CollectionConfig } from 'payload'
import { refreshAfterChange, refreshAfterDelete } from '../../lib/revalidate'
import { hasRole, isStaff } from '../../access'

/** Public coach profile shown to families in the booking carousel. Linked to a user with the coach role. */
export const AcademyCoaches: CollectionConfig = {
  slug: 'academy-coaches',
  labels: { singular: 'Coach', plural: 'Coaches' },
  admin: { group: 'Foundation Academy', useAsTitle: 'displayName', defaultColumns: ['displayName', 'user', 'active'] },
  access: {
    read: () => true,
    create: isStaff,
    // Coaches can edit their own profile; staff can edit any
    update: ({ req: { user } }) => {
      if (!user) return false
      if (hasRole(user as never, 'admin', 'committee')) return true
      return { user: { equals: user.id } }
    },
    delete: isStaff,
  },
  defaultSort: 'order',
  hooks: { afterChange: [refreshAfterChange], afterDelete: [refreshAfterDelete] },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, unique: true, filterOptions: { roles: { contains: 'coach' } }, access: { update: ({ req: { user } }) => hasRole(user as never, 'admin', 'committee') } },
    { name: 'displayName', type: 'text', required: true, admin: { description: 'Name shown to families, e.g. "Coach Sam"' } },
    { name: 'photo', type: 'upload', relationTo: 'media' },
    { name: 'bio', type: 'textarea', maxLength: 400, admin: { description: 'Short description shown in the booking carousel (max 400 characters)' } },
    { name: 'specialties', type: 'array', maxRows: 6, fields: [{ name: 'label', type: 'text', required: true }] },
    { name: 'active', type: 'checkbox', defaultValue: true, admin: { position: 'sidebar', description: 'Inactive coaches are hidden from families' }, access: { update: ({ req: { user } }) => hasRole(user as never, 'admin', 'committee') } },
    { name: 'order', type: 'number', defaultValue: 0, admin: { position: 'sidebar' } },
    { name: 'organisation', type: 'text', defaultValue: 'rowville', admin: { position: 'sidebar', readOnly: true } },
    {
      name: 'alerts',
      label: 'Alerts (the coach chooses these in the coach portal)',
      type: 'group',
      fields: [
        { type: 'row', fields: [
          { name: 'bookingEmail', label: 'New booking — email', type: 'checkbox', defaultValue: true },
          { name: 'bookingText', label: 'New booking — text', type: 'checkbox', defaultValue: true },
        ] },
        { type: 'row', fields: [
          { name: 'cancelEmail', label: 'Cancellation — email', type: 'checkbox', defaultValue: true },
          { name: 'cancelText', label: 'Cancellation — text', type: 'checkbox', defaultValue: false },
        ] },
        { type: 'row', fields: [
          { name: 'replyEmail', label: 'Parent message — email', type: 'checkbox', defaultValue: true },
          { name: 'replyText', label: 'Parent message — text', type: 'checkbox', defaultValue: false },
        ] },
      ],
    },
    // Private calendar feed link (/calendar/coach/<token>) — only the coach sees it
    { name: 'calendarToken', type: 'text', index: true, admin: { hidden: true }, access: { read: () => false, update: () => false, create: () => false } },
  ],
}
