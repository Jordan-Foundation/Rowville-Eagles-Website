import type { CollectionConfig } from 'payload'
import { isStaff } from '../access'

/** Record of changes to prices, dates, promotions and settings (written automatically; read-only). */
export const ActivityLog: CollectionConfig = {
  slug: 'activity-log',
  labels: { singular: 'Change', plural: 'Activity log' },
  admin: { group: 'People', useAsTitle: 'what', defaultColumns: ['createdAt', 'area', 'what', 'byName'] },
  access: { read: isStaff, create: () => false, update: () => false, delete: () => false },
  fields: [
    { type: 'row', fields: [{ name: 'area', type: 'text', index: true }, { name: 'what', type: 'text' }, { name: 'action', type: 'text' }] },
    { type: 'row', fields: [{ name: 'source', label: 'List', type: 'text' }, { name: 'docId', type: 'text' }] },
    { type: 'row', fields: [{ name: 'by', type: 'relationship', relationTo: 'users' }, { name: 'byName', label: 'By', type: 'text' }] },
    { name: 'changes', type: 'json' },
  ],
}
