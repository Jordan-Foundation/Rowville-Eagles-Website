import type { CollectionConfig } from 'payload'
import { hasRole } from '../access'

/**
 * Append-only history of every consent decision (APP 7 / Spam Act).
 * Nobody can edit or delete records through the app or admin — new decisions are new records.
 */
export const ConsentRecords: CollectionConfig = {
  slug: 'consent-records',
  admin: {
    group: 'People',
    defaultColumns: ['email', 'channel', 'action', 'source', 'createdAt'],
    description: 'Read-only history. Changes are made from the member’s preferences, unsubscribe links or STOP replies.',
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (hasRole(user as never, 'admin', 'committee')) return true
      return { user: { equals: user.id } }
    },
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  defaultSort: '-createdAt',
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', index: true },
    { name: 'email', type: 'email', index: true },
    { name: 'phone', type: 'text', index: true },
    {
      name: 'channel',
      type: 'select',
      required: true,
      options: [
        { label: 'Service messages', value: 'service' },
        { label: 'Marketing — email', value: 'marketing_email' },
        { label: 'Marketing — SMS', value: 'marketing_sms' },
        { label: 'All SMS (STOP)', value: 'sms_all' },
      ],
    },
    { name: 'action', type: 'select', required: true, options: ['granted', 'withdrawn'] },
    {
      name: 'basis',
      type: 'select',
      options: [
        { label: 'Express (ticked / clicked to agree)', value: 'express' },
        { label: 'Inferred (notice shown, did not opt out)', value: 'inferred' },
      ],
    },
    { name: 'wording', type: 'textarea', required: true },
    {
      name: 'source',
      type: 'select',
      required: true,
      options: [
        { label: 'Sign-up form', value: 'signup' },
        { label: 'Checkout', value: 'checkout' },
        { label: 'Profile preferences', value: 'profile' },
        { label: 'Confirm-preferences email', value: 'consent_email' },
        { label: 'Unsubscribe link', value: 'unsubscribe_link' },
        { label: 'STOP reply', value: 'stop_reply' },
        { label: 'Admin', value: 'admin' },
      ],
    },
    { name: 'ip', type: 'text' },
    { name: 'userAgent', type: 'text' },
  ],
}
