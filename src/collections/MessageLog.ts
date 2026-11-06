import type { CollectionConfig } from 'payload'
import { isStaff } from '../access'

/** Every email the site sends — audit trail and proof that marketing went only to subscribers. */
export const MessageLog: CollectionConfig = {
  slug: 'message-log',
  labels: { singular: 'Sent email', plural: 'Sent emails' },
  admin: { group: 'People', useAsTitle: 'subject', defaultColumns: ['to', 'subject', 'kind', 'status', 'createdAt'] },
  access: { read: isStaff, create: () => false, update: () => false, delete: () => false },
  defaultSort: '-createdAt',
  fields: [
    { name: 'to', type: 'text', required: true, index: true },
    { name: 'subject', type: 'text', required: true },
    { name: 'kind', type: 'select', required: true, options: ['service', 'marketing'] },
    { name: 'sender', type: 'select', options: ['club', 'academy'] },
    // Plain number (not a relationship) so logging can never wait on an unfinished save of that user.
    { name: 'userId', type: 'number', index: true },
    { name: 'status', type: 'select', options: ['sent', 'failed', 'not-configured', 'skipped-opted-out'] },
    { name: 'error', type: 'text' },
  ],
}
