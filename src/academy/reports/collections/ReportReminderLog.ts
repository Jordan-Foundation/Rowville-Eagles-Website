import type { CollectionConfig } from 'payload'
import { isStaff } from '../../../access'

/** One row per report reminder sent; the unique (cycle, coach, kind) index stops a coach getting the same one twice. */
export const ReportReminderLog: CollectionConfig = {
  slug: 'report-reminder-log',
  labels: { singular: 'Report reminder', plural: 'Report reminders' },
  admin: { hidden: true, group: 'Reports', defaultColumns: ['coach', 'cycle', 'kind', 'createdAt'] },
  access: { read: isStaff, create: () => false, update: () => false, delete: isStaff },
  defaultSort: '-createdAt',
  indexes: [{ fields: ['cycle', 'coach', 'kind'], unique: true }],
  fields: [
    { name: 'cycle', type: 'relationship', relationTo: 'report-cycles', required: true },
    { name: 'coach', type: 'relationship', relationTo: 'users', required: true },
    { name: 'kind', type: 'select', required: true, options: [{ label: '2 weeks before', value: '14d' }, { label: '1 week before', value: '7d' }, { label: '3 days before', value: '3d' }, { label: '1 day before', value: '1d' }] },
    { name: 'outstanding', type: 'number' },
  ],
}
