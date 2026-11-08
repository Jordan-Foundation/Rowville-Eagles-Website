import type { CollectionConfig } from 'payload'
import { isStaff } from '../../access'

/** Parent forum (Rowville teams): members ask, coaches answer; coaches/admins pin, lock and remove posts. */
export const ForumThreads: CollectionConfig = {
  slug: 'forum-threads',
  labels: { singular: 'Team Chat thread', plural: 'Team Chat threads' },
  admin: { group: 'Club', useAsTitle: 'title', defaultColumns: ['title', 'team', 'author', 'pinned', 'locked', 'lastActivityAt'] },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: '-lastActivityAt',
  fields: [
    { name: 'team', type: 'relationship', relationTo: 'teams', required: true, index: true },
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'textarea', required: true },
    { name: 'author', type: 'relationship', relationTo: 'users', required: true },
    { type: 'row', fields: [
      { name: 'pinned', type: 'checkbox', defaultValue: false },
      { name: 'locked', type: 'checkbox', defaultValue: false },
      { name: 'lastActivityAt', type: 'date', index: true, admin: { readOnly: true } },
    ] },
    { type: 'row', fields: [
      { name: 'removedAt', type: 'date', admin: { readOnly: true, description: 'Removed by a moderator (kept for the record)' } },
      { name: 'removedBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
    ] },
  ],
}

export const ForumReplies: CollectionConfig = {
  slug: 'forum-replies',
  labels: { singular: 'Team Chat reply', plural: 'Team Chat replies' },
  admin: { group: 'Club', defaultColumns: ['thread', 'author', 'createdAt'] },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: 'createdAt',
  fields: [
    { name: 'thread', type: 'relationship', relationTo: 'forum-threads', required: true, index: true },
    { name: 'body', type: 'textarea', required: true },
    { name: 'author', type: 'relationship', relationTo: 'users', required: true },
    { type: 'row', fields: [
      { name: 'removedAt', type: 'date', admin: { readOnly: true } },
      { name: 'removedBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
    ] },
  ],
}
