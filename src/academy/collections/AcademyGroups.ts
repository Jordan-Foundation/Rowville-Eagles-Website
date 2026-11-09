import type { CollectionConfig } from 'payload'
import { isStaff } from '../../access'
import { weekdayOptions } from '../constants'
import { makeReference } from '../../lib/reference'

/**
 * A small group session: 2–5 players with one coach, set up by the coach. Each player has their own
 * invite (academy-group-invites) and, once they pay, their own academy-bookings row and session rows.
 * The group holds its time with one `group-slot` session row per date, so the coach can't be booked
 * for a 1-on-1 (or another group) at the same time.
 */
export const AcademyGroups: CollectionConfig = {
  slug: 'academy-groups',
  labels: { singular: 'Small group', plural: 'Small groups' },
  admin: {
    group: 'Foundation Academy',
    useAsTitle: 'reference',
    defaultColumns: ['reference', 'coach', 'type', 'firstSessionAt', 'plannedSize', 'ratePerPlayer', 'status'],
    description: 'Small group sessions (2–5 players, one coach). Coaches set these up from My sessions.',
  },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: () => false },
  defaultSort: '-createdAt',
  hooks: {
    beforeValidate: [({ data, operation }) => {
      if (operation === 'create' && data && !data.reference) data.reference = makeReference('RFG')
      return data
    }],
  },
  fields: [
    { name: 'reference', type: 'text', required: true, unique: true, admin: { readOnly: true } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'forming',
      index: true,
      options: [
        { label: 'Forming (waiting for families to pay)', value: 'forming' },
        { label: 'Confirmed', value: 'confirmed' },
        { label: 'Short of players (coach to decide)', value: 'shortfall' },
        { label: 'Completed', value: 'completed' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'type', type: 'select', required: true, options: [{ label: 'Casual (one-off)', value: 'casual' }, { label: 'Term (weekly)', value: 'term' }], admin: { position: 'sidebar' } },
    { type: 'row', fields: [
      { name: 'coach', type: 'relationship', relationTo: 'academy-coaches', required: true, index: true },
      { name: 'term', type: 'relationship', relationTo: 'academy-terms', required: true },
    ] },
    { type: 'row', fields: [
      { name: 'weekday', type: 'select', options: weekdayOptions },
      { name: 'startTime', type: 'text' },
      { name: 'firstSessionAt', label: 'First (or only) session', type: 'date', required: true, index: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    ] },
    { type: 'row', fields: [
      { name: 'plannedSize', label: 'Players', type: 'number', required: true, min: 2, max: 5 },
      { name: 'pricingSize', label: 'Priced as a group of', type: 'number', required: true, min: 2, max: 5, admin: { readOnly: true, description: 'The size the price came from — it stays the same if the group changes' } },
      { name: 'ratePerPlayer', label: 'Price per player, per session (AUD)', type: 'number', required: true, admin: { readOnly: true, description: 'Locked when the group was set up' } },
      { name: 'sessionsTotal', label: 'Sessions', type: 'number', required: true, min: 1 },
    ] },
    { type: 'row', fields: [
      { name: 'paymentDeadline', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'reminderSentAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    ] },
    {
      name: 'termOffer',
      label: 'Term offer (one-off groups)',
      type: 'group',
      admin: { condition: (d) => d?.type === 'casual' },
      fields: [
        { type: 'row', fields: [
          { name: 'status', type: 'select', defaultValue: 'none', options: ['none', 'proposed', 'accepted', 'declined', 'expired'] },
          { name: 'proposedBy', type: 'relationship', relationTo: 'academy-group-invites' },
          { name: 'deadline', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
        ] },
      ],
    },
    { name: 'createdBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
    {
      name: 'history',
      type: 'array',
      admin: { readOnly: true, initCollapsed: true },
      fields: [
        { type: 'row', fields: [
          { name: 'at', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
          { name: 'by', type: 'relationship', relationTo: 'users' },
          { name: 'action', type: 'text', required: true },
        ] },
        { name: 'note', type: 'textarea' },
      ],
    },
  ],
}
