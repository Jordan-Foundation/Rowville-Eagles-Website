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
    { name: 'logo', type: 'upload', relationTo: 'media', admin: { description: 'Upload a logo (PNG/SVG with a transparent background works best).' } },
    {
      name: 'logoUrl',
      label: 'Logo file path',
      type: 'text',
      admin: { description: 'Used when no logo is uploaded, e.g. /sponsors/coles.png' },
    },
    {
      name: 'tileColor',
      label: 'Tile background colour',
      type: 'text',
      admin: { description: 'Only for logos that come with their own background (e.g. #0b1045). Leave empty for a white card.' },
    },
    { name: 'website', type: 'text', admin: { description: 'Full link, e.g. https://www.coles.com.au' } },
    { name: 'blurb', type: 'textarea', maxLength: 200, admin: { description: 'One or two lines shown on the Sponsors page' } },
    { name: 'order', type: 'number', defaultValue: 0 },
  ],
}
