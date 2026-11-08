import type { CollectionConfig } from 'payload'
import { isStaff } from '../../access'
import { weekdayOptions } from '../constants'

/**
 * A coach's personal booking link for one family: one open time (casual) or weekly slot (term), optionally
 * held for them for 0–72 hours. The link opens the booking page with the coach and time chosen and the
 * family's details filled in. Only a hash of the link's secret is stored.
 */
export const AcademyShareLinks: CollectionConfig = {
  slug: 'academy-share-links',
  labels: { singular: 'Coach share link', plural: 'Coach share links' },
  admin: { group: 'Foundation Academy', useAsTitle: 'label', defaultColumns: ['label', 'coach', 'status', 'holdUntil', 'createdAt'] },
  access: { read: isStaff, create: () => false, update: isStaff, delete: isStaff },
  defaultSort: '-createdAt',
  fields: [
    { name: 'label', type: 'text', admin: { readOnly: true } },
    { name: 'tokenHash', type: 'text', required: true, unique: true, index: true, admin: { hidden: true } },
    { type: 'row', fields: [
      { name: 'coach', type: 'relationship', relationTo: 'academy-coaches', required: true, index: true },
      { name: 'term', type: 'relationship', relationTo: 'academy-terms', required: true },
      { name: 'mode', type: 'select', required: true, options: [{ label: 'Casual session', value: 'casual' }, { label: 'Whole term (weekly)', value: 'term' }] },
    ] },
    { type: 'row', fields: [
      { name: 'startsAt', label: 'Session (casual)', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'weekday', type: 'select', options: weekdayOptions },
      { name: 'startTime', type: 'text' },
    ] },
    {
      name: 'client',
      label: 'Family',
      type: 'group',
      fields: [
        { type: 'row', fields: [{ name: 'firstName', type: 'text', required: true }, { name: 'lastName', type: 'text', required: true }, { name: 'playerFirstName', label: 'Player first name', type: 'text' }] },
        { type: 'row', fields: [{ name: 'email', type: 'email', required: true }, { name: 'mobile', type: 'text' }] },
      ],
    },
    { name: 'message', label: 'Message from the coach', type: 'textarea' },
    { type: 'row', fields: [
      { name: 'holdHours', type: 'number', min: 0, max: 72 },
      { name: 'holdUntil', label: 'Held until', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'expiresAt', label: 'Link works until', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    ] },
    { type: 'row', fields: [
      { name: 'status', type: 'select', required: true, defaultValue: 'active', index: true, options: [{ label: 'Sent', value: 'active' }, { label: 'Booked', value: 'booked' }, { label: 'Cancelled', value: 'cancelled' }] },
      { name: 'holdBooking', label: 'Reservation', type: 'relationship', relationTo: 'academy-bookings', admin: { readOnly: true } },
      { name: 'booking', label: 'Booking made', type: 'relationship', relationTo: 'academy-bookings', index: true, admin: { readOnly: true } },
    ] },
    { type: 'row', fields: [
      { name: 'sentEmail', type: 'checkbox', admin: { readOnly: true } },
      { name: 'sentSms', type: 'checkbox', admin: { readOnly: true } },
      { name: 'openedAt', label: 'First opened', type: 'date', admin: { readOnly: true } },
      { name: 'createdBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
    ] },
  ],
}
