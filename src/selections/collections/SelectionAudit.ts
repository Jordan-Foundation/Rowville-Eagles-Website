import type { CollectionConfig } from 'payload'
import { isStaff } from '../../access'

/** Who changed what on the trialist page and the depth chart, and when. Never edited. */
export const SelectionAudit: CollectionConfig = {
  slug: 'selection-audit',
  labels: { singular: 'Selection change', plural: 'Selection changes' },
  admin: { group: 'Selections', defaultColumns: ['createdAt', 'action', 'summary', 'by'] },
  access: { read: isStaff, create: () => false, update: () => false, delete: () => false },
  defaultSort: '-createdAt',
  fields: [
    { name: 'round', type: 'relationship', relationTo: 'selection-rounds', index: true },
    { name: 'entry', type: 'relationship', relationTo: 'selection-entries', index: true },
    { name: 'squad', type: 'relationship', relationTo: 'squads', index: true },
    { name: 'action', type: 'text', required: true, index: true },
    { name: 'summary', type: 'text', required: true },
    { name: 'by', type: 'relationship', relationTo: 'users' },
  ],
}
