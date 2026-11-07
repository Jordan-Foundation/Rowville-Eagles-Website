import type { CollectionConfig } from 'payload'
import { hasRole } from '../../../access'

/** A video sent in: a stage attempt (verification), a request for feedback (Premium) or a monthly challenge entry (Premium). */
export const PdrSubmissions: CollectionConfig = {
  slug: 'pdr-submissions',
  labels: { singular: 'Video submission', plural: 'Video submissions' },
  admin: { group: 'Foundation+', useAsTitle: 'label', defaultColumns: ['label', 'type', 'status', 'claimedScore', 'verifiedScore', 'createdAt'] },
  access: {
    read: ({ req: { user } }) => hasRole(user as never, 'admin', 'committee', 'coach'),
    create: () => false,
    update: ({ req: { user } }) => hasRole(user as never, 'admin'),
    delete: ({ req: { user } }) => hasRole(user as never, 'admin'),
  },
  defaultSort: '-createdAt',
  fields: [
    { name: 'label', type: 'text', admin: { hidden: true } },
    { type: 'row', fields: [
      { name: 'player', type: 'relationship', relationTo: 'participants', required: true, index: true },
      { name: 'stage', type: 'relationship', relationTo: 'pdr-stages', index: true },
      { name: 'challenge', label: 'Monthly challenge', type: 'relationship', relationTo: 'pdr-challenges', index: true },
    ] },
    { type: 'row', fields: [{ name: 'area', type: 'relationship', relationTo: 'pdr-areas', index: true }, { name: 'levelNumber', type: 'number', index: true }] },
    {
      type: 'row',
      fields: [
        { name: 'type', type: 'select', required: true, defaultValue: 'verification', index: true, options: [{ label: 'Stage attempt', value: 'verification' }, { label: 'Feedback only', value: 'feedback' }, { label: 'Monthly challenge entry', value: 'challenge' }] },
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'uploading',
          index: true,
          options: [
            { label: 'Uploading', value: 'uploading' },
            { label: 'Waiting for a coach', value: 'pending' },
            { label: 'Verified', value: 'verified' },
            { label: 'Needs another attempt', value: 'rejected' },
            { label: 'Feedback given', value: 'feedback_given' },
          ],
        },
      ],
    },
    { type: 'row', fields: [{ name: 'claimedScore', type: 'number' }, { name: 'verifiedScore', type: 'number' }, { name: 'passed', label: 'Passed the stage', type: 'checkbox', admin: { readOnly: true } }] },
    { name: 'playerNote', label: 'Note from the player', type: 'textarea' },
    { name: 'feedback', label: 'Coach feedback', type: 'textarea' },
    { type: 'row', fields: [{ name: 'reviewedBy', type: 'relationship', relationTo: 'users' }, { name: 'reviewedAt', type: 'date' }, { name: 'submittedBy', type: 'relationship', relationTo: 'users' }] },
    { type: 'row', fields: [{ name: 'streamUid', type: 'text', index: true, admin: { readOnly: true } }, { name: 'deleteVideoAfter', type: 'date', index: true }, { name: 'videoDeletedAt', type: 'date' }] },
  ],
}
