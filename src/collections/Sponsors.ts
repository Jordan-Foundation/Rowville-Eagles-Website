import type { CollectionConfig } from 'payload'
import { anyone, isStaff } from '../access'

export const Sponsors: CollectionConfig = {
  slug: 'sponsors',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'tier'], group: 'Club' },
  access: { read: anyone, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: 'order',
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'tier',
      type: 'select',
      required: true,
      defaultValue: 'community',
      options: [
        { label: 'Major partner', value: 'major' },
        { label: 'Gold', value: 'gold' },
        { label: 'Silver', value: 'silver' },
        { label: 'Community', value: 'community' },
      ],
    },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    { name: 'website', type: 'text' },
    { name: 'order', type: 'number', defaultValue: 0 },
  ],
}
