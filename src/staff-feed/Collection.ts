import type { CollectionConfig } from 'payload'
import { isStaff } from '../access'

/** Everything Management should know about: bookings, payments, trial sign-ups and problems (written by hooks). */
export const StaffFeed: CollectionConfig = {
  slug: 'staff-feed',
  labels: { singular: 'Notification', plural: 'Notifications' },
  admin: { group: 'Club', useAsTitle: 'title', defaultColumns: ['title', 'kind', 'urgent', 'textStatus', 'createdAt'], description: 'Use Management → Notifications.' },
  access: { read: isStaff, create: () => false, update: () => false, delete: isStaff },
  defaultSort: '-createdAt',
  fields: [
    { type: 'row', fields: [
      { name: 'kind', type: 'select', required: true, index: true, options: [{ label: 'Needs attention', value: 'problem' }, { label: 'Trial sign-up', value: 'trial' }, { label: 'Enquiry', value: 'enquiry' }, { label: 'Booking', value: 'booking' }, { label: 'Payment', value: 'payment' }] },
      { name: 'urgent', type: 'checkbox', defaultValue: false, index: true },
      { name: 'pushStatus', label: 'Phone notification', type: 'select', defaultValue: 'none', index: true, options: [{ label: 'Not sent', value: 'none' }, { label: 'Sent', value: 'sent' }, { label: 'Held for 7am', value: 'held' }] },
      { name: 'textStatus', type: 'select', defaultValue: 'none', index: true, options: [{ label: 'No text', value: 'none' }, { label: 'Texted', value: 'sent' }, { label: 'Held for 7am', value: 'held' }, { label: 'Text failed', value: 'failed' }] },
    ] },
    { name: 'title', type: 'text', required: true },
    { name: 'detail', type: 'text' },
    { name: 'href', type: 'text' },
    { name: 'sourceKey', type: 'text', unique: true, admin: { hidden: true, description: 'Stops the same event being recorded twice' } },
    { name: 'digestedAt', type: 'date', index: true },
  ],
}
