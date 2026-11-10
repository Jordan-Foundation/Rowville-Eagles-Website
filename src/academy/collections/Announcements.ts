import type { CollectionConfig } from 'payload'
import { isStaff } from '../../access'

/**
 * "Registrations are open" messages to every family opted in to marketing (email + text), and the
 * reminder a week later to those who haven't registered. The first one each year waits for
 * Management to approve it (with a preview); every send is logged.
 */
export const Announcements: CollectionConfig = {
  slug: 'announcements',
  labels: { singular: 'Announcement', plural: 'Announcements' },
  admin: { group: 'Foundation Academy', useAsTitle: 'subject', defaultColumns: ['subject', 'kind', 'status', 'scheduledFor', 'sentAt'], description: 'Use Management → Announcements.' },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: () => false },
  defaultSort: '-createdAt',
  fields: [
    { type: 'row', fields: [
      { name: 'program', type: 'relationship', relationTo: 'programs', required: true, index: true },
      { name: 'kind', type: 'select', required: true, options: [{ label: 'Registrations open', value: 'open' }, { label: 'Reminder (not registered yet)', value: 'reminder' }] },
      { name: 'year', type: 'number', index: true },
    ] },
    {
      name: 'status',
      type: 'select',
      required: true,
      index: true,
      defaultValue: 'needs-approval',
      options: [
        { label: 'Waiting for approval', value: 'needs-approval' },
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Sending', value: 'sending' },
        { label: 'Sent', value: 'sent' },
        { label: 'Not sent', value: 'cancelled' },
      ],
    },
    { name: 'subject', type: 'text', required: true },
    { name: 'message', type: 'textarea', required: true, admin: { description: 'The email text (the prices, dates, register link and the $950 note are added automatically)' } },
    { name: 'smsText', label: 'Text message', type: 'textarea', admin: { description: '“– Foundation Academy. Reply STOP to opt out” is added automatically' } },
    { type: 'row', fields: [
      { name: 'scheduledFor', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'approvedBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
      { name: 'sentAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'sendCompletedAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    ] },
    { name: 'sendState', type: 'json', admin: { hidden: true } },
    { name: 'sentCounts', type: 'json', admin: { readOnly: true } },
  ],
}
