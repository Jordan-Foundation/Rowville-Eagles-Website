import type { CollectionConfig } from 'payload'
import { isStaff, publishedOrStaff } from '../access'

export const Posts: CollectionConfig = {
  slug: 'posts',
  labels: { singular: 'News article', plural: 'News' },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'category', 'publishedAt', 'status'], group: 'Club' },
  access: { read: publishedOrStaff(), create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: '-publishedAt',
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    {
      type: 'row',
      fields: [
        {
          name: 'category',
          type: 'select',
          options: ['Club news', 'Match report', 'Academy', 'Community', 'Sponsors'],
          defaultValue: 'Club news',
        },
        { name: 'publishedAt', type: 'date', required: true },
        {
          name: 'status',
          type: 'select',
          defaultValue: 'draft',
          options: ['draft', 'published'],
        },
      ],
    },
    { name: 'excerpt', type: 'textarea', required: true, maxLength: 240 },
    { name: 'heroImage', type: 'upload', relationTo: 'media' },
    { name: 'content', type: 'richText' },
  ],
}
