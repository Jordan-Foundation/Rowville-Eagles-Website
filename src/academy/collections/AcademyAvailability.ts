import type { CollectionConfig } from 'payload'
import { isStaff } from '../../access'
import { weekdayOptions } from '../constants'

/**
 * A coach's recurring weekly 1-on-1 availability for one term (one record per coach per term).
 * Written by the coach portal; every change is appended to `changes` for the admin.
 */
export const AcademyAvailability: CollectionConfig = {
  slug: 'academy-availability',
  labels: { singular: 'Coach availability', plural: 'Coach availability' },
  admin: { group: 'Foundation Academy', defaultColumns: ['coach', 'term', 'submittedAt', 'updatedAt'] },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  indexes: [{ fields: ['coach', 'term'], unique: true }],
  fields: [
    { type: 'row', fields: [
      { name: 'coach', type: 'relationship', relationTo: 'academy-coaches', required: true },
      { name: 'term', type: 'relationship', relationTo: 'academy-terms', required: true },
    ] },
    {
      name: 'slots',
      type: 'array',
      fields: [
        { type: 'row', fields: [
          { name: 'weekday', type: 'select', required: true, options: weekdayOptions },
          { name: 'startTime', type: 'text', required: true },
        ] },
      ],
    },
    { name: 'submittedAt', type: 'date', admin: { readOnly: true, description: 'When the coach first submitted. Reminders stop once this is set.' } },
    {
      name: 'changes',
      type: 'array',
      admin: { readOnly: true, initCollapsed: true, description: 'History of edits made in the coach portal' },
      fields: [
        { name: 'at', type: 'date' },
        { name: 'added', type: 'text' },
        { name: 'removed', type: 'text' },
      ],
    },
  ],
}
