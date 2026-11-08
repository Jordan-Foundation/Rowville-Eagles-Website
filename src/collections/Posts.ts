import type { CollectionConfig } from 'payload'
import { refreshAfterChange, refreshAfterDelete } from '../lib/revalidate'
import { isStaff, publishedOrStaff } from '../access'

export const Posts: CollectionConfig = {
  slug: 'posts',
  labels: { singular: 'News article', plural: 'News' },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'category', 'publishedAt', 'status'], group: 'Club' },
  access: { read: publishedOrStaff(), create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: '-publishedAt',
  hooks: { afterChange: [refreshAfterChange], afterDelete: [refreshAfterDelete] },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    {
      type: 'row',
      fields: [
        {
          name: 'category',
          type: 'select',
          options: ['Club news', 'Match report', 'Tournament', 'Seniors', 'Academy', 'Community', 'Sponsors'],
          defaultValue: 'Club news',
        },
        { name: 'publishedAt', type: 'date', required: true },
        {
          name: 'status', index: true,
          type: 'select',
          defaultValue: 'draft',
          options: ['draft', 'published'],
        },
      ],
    },
    {
      name: 'teams',
      type: 'relationship',
      relationTo: 'teams',
      hasMany: true,
      admin: { description: 'Tag teams to show this on the Fixtures page team news (match reports, tournaments, senior games…)' },
    },
    { name: 'excerpt', type: 'textarea', required: true, maxLength: 240 },
    { name: 'heroImage', type: 'upload', relationTo: 'media' },
    { name: 'content', type: 'richText' },
  ],
}
