import type { CollectionConfig } from 'payload'
import { isStaff } from '../access'

/**
 * One conversation per family (their account), or per unknown mobile number ("Unassigned").
 * Everything goes through the platform and is kept, so admins can see every message (Child Safe).
 */
export const Conversations: CollectionConfig = {
  slug: 'conversations',
  labels: { singular: 'Conversation', plural: 'Conversations' },
  admin: { group: 'People', useAsTitle: 'title', defaultColumns: ['title', 'phone', 'lastMessageAt', 'lastPreview'] },
  access: { read: isStaff, create: () => false, update: isStaff, delete: () => false },
  defaultSort: '-lastMessageAt',
  fields: [
    { name: 'title', type: 'text', required: true },
    { type: 'row', fields: [
      { name: 'account', label: 'Family account', type: 'relationship', relationTo: 'users', unique: true, index: true },
      { name: 'phone', label: 'Mobile (unassigned only)', type: 'text', index: true },
    ] },
    { name: 'coaches', label: 'Coaches who can see it', type: 'relationship', relationTo: 'academy-coaches', hasMany: true, index: true, admin: { description: 'Coaches the family has booked with — kept up to date automatically.' } },
    { type: 'row', fields: [
      { name: 'lastMessageAt', type: 'date', index: true, admin: { readOnly: true } },
      { name: 'lastFamilyAt', label: 'Last from family', type: 'date', admin: { readOnly: true } },
      { name: 'lastStaffAt', label: 'Last from coach/admin', type: 'date', admin: { readOnly: true } },
      { name: 'lastAlertAt', type: 'date', admin: { readOnly: true } },
    ] },
    { name: 'lastPreview', type: 'text', admin: { readOnly: true } },
    {
      name: 'reads',
      type: 'array',
      admin: { readOnly: true, description: 'When each person last read the conversation (for unread badges).' },
      fields: [{ type: 'row', fields: [{ name: 'user', type: 'relationship', relationTo: 'users', required: true }, { name: 'at', type: 'date', required: true }] }],
    },
  ],
}

export const Messages: CollectionConfig = {
  slug: 'messages',
  labels: { singular: 'Message', plural: 'Messages' },
  admin: { group: 'People', useAsTitle: 'body', defaultColumns: ['conversation', 'direction', 'authorRole', 'channel', 'body', 'createdAt'] },
  access: { read: isStaff, create: () => false, update: () => false, delete: () => false },
  defaultSort: '-createdAt',
  fields: [
    { name: 'conversation', type: 'relationship', relationTo: 'conversations', required: true, index: true },
    { type: 'row', fields: [
      { name: 'direction', type: 'select', required: true, options: [{ label: 'From the family', value: 'in' }, { label: 'To the family', value: 'out' }, { label: 'Note', value: 'note' }] },
      { name: 'channel', type: 'select', required: true, options: [{ label: 'Text message', value: 'sms' }, { label: 'Player portal', value: 'portal' }, { label: 'Email', value: 'email' }, { label: 'System', value: 'system' }] },
      { name: 'authorRole', type: 'select', required: true, options: ['family', 'coach', 'admin', 'system'] },
    ] },
    { type: 'row', fields: [
      { name: 'author', type: 'relationship', relationTo: 'users' },
      { name: 'authorName', type: 'text' },
      { name: 'delivery', type: 'select', options: [{ label: 'Texted', value: 'sms' }, { label: 'Emailed (no text possible)', value: 'email' }, { label: 'Not sent', value: 'failed' }, { label: 'Received', value: 'received' }] },
    ] },
    { name: 'body', type: 'textarea', required: true },
    { name: 'twilioSid', type: 'text', index: true },
  ],
}
