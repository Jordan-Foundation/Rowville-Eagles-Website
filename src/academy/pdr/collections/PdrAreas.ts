import type { CollectionConfig } from 'payload'
import { isStaff } from '../../../access'

export const PdrAreas: CollectionConfig = {
  slug: 'pdr-areas',
  labels: { singular: 'Area', plural: 'Areas' },
  admin: { group: 'Player Development', useAsTitle: 'name', defaultColumns: ['name', 'order', 'hasLeaderboard'], description: 'The footballing areas, e.g. Passing. Each has levels, and each level has stages.' },
  access: { read: () => true, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: 'order',
  fields: [
    { type: 'row', fields: [{ name: 'name', type: 'text', required: true, unique: true }, { name: 'slug', type: 'text', required: true, unique: true, index: true }, { name: 'order', type: 'number', defaultValue: 1 }] },
    { type: 'row', fields: [{ name: 'hasLeaderboard', label: 'Has a leaderboard', type: 'checkbox', defaultValue: true }, { name: 'colour', type: 'text', admin: { description: 'e.g. #3b82f6' } }] },
    { name: 'description', type: 'textarea' },
  ],
}
