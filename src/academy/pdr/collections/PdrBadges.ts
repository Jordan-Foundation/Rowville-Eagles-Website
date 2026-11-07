import type { CollectionConfig } from 'payload'
import { isStaff } from '../../../access'

/** Level badges (one per area level, created automatically) and monthly challenge badges. */
export const PdrBadges: CollectionConfig = {
  slug: 'pdr-badges',
  labels: { singular: 'Badge', plural: 'Badges' },
  admin: { group: 'Foundation+', useAsTitle: 'name', defaultColumns: ['name', 'type', 'area', 'level', 'placeholder'] },
  access: { read: () => true, create: isStaff, update: isStaff, delete: isStaff },
  fields: [
    { type: 'row', fields: [{ name: 'name', type: 'text', required: true }, { name: 'type', type: 'select', required: true, defaultValue: 'level', options: [{ label: 'Level badge', value: 'level' }, { label: 'Monthly challenge', value: 'monthly' }] }] },
    {
      type: 'row',
      fields: [
        { name: 'area', type: 'relationship', relationTo: 'pdr-areas', admin: { condition: (d) => d?.type === 'level' } },
        { name: 'level', type: 'relationship', relationTo: 'pdr-levels', unique: true, admin: { condition: (d) => d?.type === 'level', description: 'Earned by passing every stage of this level' } },
      ],
    },
    { name: 'artwork', type: 'upload', relationTo: 'media' },
    { name: 'howToEarn', label: 'How to earn it', type: 'text' },
    { name: 'placeholder', type: 'checkbox', defaultValue: false, admin: { description: 'Name/artwork still to be decided' } },
  ],
}
