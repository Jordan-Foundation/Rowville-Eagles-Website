import type { CollectionConfig } from 'payload'
import { isStaff } from '../access'

/** Every email and SMS the site sends, plus texts and calls received on the Twilio number — audit trail and proof that marketing went only to subscribers. */
export const MessageLog: CollectionConfig = {
  slug: 'message-log',
  labels: { singular: 'Sent email / text', plural: 'Sent emails & texts' },
  admin: { group: 'People', useAsTitle: 'subject', defaultColumns: ['channel', 'to', 'subject', 'status', 'createdAt'] },
  access: { read: isStaff, create: () => false, update: () => false, delete: () => false },
  defaultSort: '-createdAt',
  fields: [
    {
      name: 'channel',
      type: 'select',
      defaultValue: 'email',
      index: true,
      options: [
        { label: 'Email', value: 'email' },
        { label: 'SMS sent', value: 'sms' },
        { label: 'SMS received', value: 'sms_in' },
        { label: 'Phone call', value: 'call' },
      ],
    },
    { name: 'to', label: 'To / from', type: 'text', required: true, index: true },
    { name: 'subject', label: 'Subject / message', type: 'text', required: true },
    { name: 'kind', type: 'select', required: true, options: ['service', 'marketing'] },
    { name: 'sender', type: 'select', options: ['club', 'academy'] },
    // Plain number (not a relationship) so logging can never wait on an unfinished save of that user.
    { name: 'userId', type: 'number', index: true },
    { name: 'status', type: 'select', options: ['sent', 'failed', 'not-configured', 'skipped-opted-out', 'received', 'answered', 'missed', 'voicemail'] },
    { name: 'providerId', label: 'Twilio ID', type: 'text', index: true },
    { name: 'error', type: 'text' },
  ],
}
