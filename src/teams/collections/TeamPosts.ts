import type { CollectionConfig } from 'payload'
import { isStaff } from '../../access'

/** Notice board posts. Only coaches/admins post (from the team page); each new post is emailed + texted to members. */
export const TeamPosts: CollectionConfig = {
  slug: 'team-posts',
  labels: { singular: 'Notice', plural: 'Notices' },
  admin: { group: 'Club', useAsTitle: 'title', defaultColumns: ['title', 'team', 'author', 'pinned', 'createdAt'] },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: '-createdAt',
  fields: [
    { name: 'team', type: 'relationship', relationTo: 'teams', required: true, index: true },
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'textarea', required: true },
    { type: 'row', fields: [
      { name: 'author', type: 'relationship', relationTo: 'users', required: true },
      { name: 'pinned', type: 'checkbox', defaultValue: false },
    ] },
    { type: 'row', fields: [
      { name: 'sentAt', label: 'Last sent to members', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'sentTo', label: 'Members sent to', type: 'number', admin: { readOnly: true } },
      { name: 'editedAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    ] },
  ],
}
