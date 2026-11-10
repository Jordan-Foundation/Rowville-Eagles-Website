import type { CollectionConfig } from 'payload'
import { isStaff } from '../access'

/**
 * Times a coach is booked elsewhere (a confirmed camp day). Families can't book a 1-on-1 or small group
 * with them then, and Management sees it as a clash.
 */
export const CoachBlocks: CollectionConfig = {
  slug: 'coach-blocks',
  labels: { singular: 'Coach block', plural: 'Coach blocks' },
  admin: { group: 'Foundation Academy', defaultColumns: ['coach', 'from', 'to', 'reason'], description: 'Created automatically when a coach confirms a holiday camp.' },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  fields: [
    { name: 'coach', type: 'relationship', relationTo: 'academy-coaches', required: true, index: true },
    { type: 'row', fields: [
      { name: 'from', type: 'date', required: true, index: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'to', type: 'date', required: true, index: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    ] },
    { name: 'reason', type: 'text', required: true },
    { type: 'row', fields: [
      { name: 'program', type: 'relationship', relationTo: 'programs', index: true },
      { name: 'campCoach', type: 'relationship', relationTo: 'camp-coaches', index: true },
    ] },
  ],
}
