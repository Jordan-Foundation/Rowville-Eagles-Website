import type { CollectionConfig } from 'payload'
import { isStaff } from '../../access'

/**
 * One row per reminder sent. The unique (coach, term, kind) index means a coach can never receive the
 * same reminder twice — the row is written *before* the email goes out.
 */
export const AcademyReminderLog: CollectionConfig = {
  slug: 'academy-reminder-log',
  labels: { singular: 'Availability reminder', plural: 'Availability reminders' },
  admin: { group: 'Foundation Academy', defaultColumns: ['coach', 'term', 'kind', 'createdAt'] },
  access: { read: isStaff, create: () => false, update: () => false, delete: isStaff },
  defaultSort: '-createdAt',
  indexes: [{ fields: ['coach', 'term', 'kind'], unique: true }],
  fields: [
    { name: 'coach', type: 'relationship', relationTo: 'academy-coaches', required: true },
    { name: 'term', type: 'relationship', relationTo: 'academy-terms', required: true },
    {
      name: 'kind',
      type: 'select',
      required: true,
      options: [
        { label: '2 weeks before', value: '14d' },
        { label: '1 week before', value: '7d' },
        { label: '3 days before', value: '3d' },
        { label: '1 day before', value: '1d' },
      ],
    },
    { name: 'to', type: 'text' },
  ],
}
