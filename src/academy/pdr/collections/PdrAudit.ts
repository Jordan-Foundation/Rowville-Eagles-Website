import type { CollectionConfig } from 'payload'
import { hasRole } from '../../../access'

/** Append-only record of every verification, rejection, score change and promotion. */
export const PdrAudit: CollectionConfig = {
  slug: 'pdr-audit',
  labels: { singular: 'Audit entry', plural: 'Audit trail' },
  admin: { group: 'Foundation+', useAsTitle: 'summary', defaultColumns: ['summary', 'action', 'actor', 'createdAt'] },
  access: { read: ({ req: { user } }) => hasRole(user as never, 'admin', 'committee'), create: () => false, update: () => false, delete: () => false },
  defaultSort: '-createdAt',
  fields: [
    { name: 'summary', type: 'text' },
    {
      type: 'row',
      fields: [
        { name: 'action', type: 'select', required: true, index: true, options: ['verify', 'reject', 'feedback', 'score_change', 'promote', 'revoke'] },
        { name: 'actor', type: 'relationship', relationTo: 'users' },
      ],
    },
    { type: 'row', fields: [{ name: 'player', type: 'relationship', relationTo: 'participants', index: true }, { name: 'stage', type: 'relationship', relationTo: 'pdr-stages' }, { name: 'submission', type: 'relationship', relationTo: 'pdr-submissions' }] },
    { type: 'row', fields: [{ name: 'before', type: 'text' }, { name: 'after', type: 'text' }] },
    { name: 'note', type: 'textarea' },
  ],
}
