import type { CollectionConfig } from 'payload'
import { isStaff } from '../access'

/**
 * Which age group each child is in at a holiday camp (one row per child's booking).
 * Worked out automatically as bookings come in; a child moved by hand is locked in their group.
 */
export const CampPlacements: CollectionConfig = {
  slug: 'camp-placements',
  labels: { singular: 'Camp placement', plural: 'Camp placements' },
  admin: { group: 'Programs', useAsTitle: 'name', defaultColumns: ['name', 'program', 'group', 'locked'], description: 'Camp age groups — managed from Management → the camp’s page.', hidden: ({ user }) => !user },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  fields: [
    { name: 'program', type: 'relationship', relationTo: 'programs', required: true, index: true },
    { name: 'booking', type: 'relationship', relationTo: 'bookings', required: true, unique: true },
    { name: 'name', type: 'text', required: true },
    { type: 'row', fields: [
      { name: 'group', type: 'number', required: true, min: 1 },
      { name: 'locked', type: 'checkbox', defaultValue: false, admin: { description: 'Placed by hand — automatic regrouping leaves this child here' } },
    ] },
    { type: 'row', fields: [
      { name: 'movedBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
      { name: 'movedAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    ] },
  ],
}
