import type { CollectionConfig } from 'payload'
import { isStaff, staffOrOwner } from '../../access'

/**
 * Session credit ledger. One credit = one 60-minute 1-on-1 (whatever was paid for it).
 * Positive = credits given (expire after 12 months), negative = credits used.
 * A checkout reserves credits as `pending`; they become `active` when paid and `void` if the
 * checkout is abandoned. Rows are never deleted. Balance maths: academy/credit-ledger.ts.
 */
export const AcademyCredits: CollectionConfig = {
  slug: 'academy-credits',
  labels: { singular: 'Session credit', plural: 'Session credits' },
  admin: {
    group: 'Foundation Academy',
    defaultColumns: ['account', 'sessions', 'reason', 'status', 'expiresAt', 'booking'],
    description: 'Session credits given for cancellations (and used at checkout). One credit = one 1-on-1. Give goodwill credits from a booking’s page in Management → Academy.',
  },
  access: { read: staffOrOwner('account'), create: isStaff, update: isStaff, delete: () => false },
  defaultSort: '-createdAt',
  fields: [
    { name: 'account', type: 'relationship', relationTo: 'users', required: true, index: true },
    { type: 'row', fields: [
      { name: 'sessions', type: 'number', required: true, admin: { step: 1, description: 'Positive = given, negative = used. One credit = one 1-on-1.' } },
      { name: 'expiresAt', type: 'date', admin: { description: 'Credits given expire 12 months later', date: { pickerAppearance: 'dayOnly' } } },
      { name: 'status', type: 'select', required: true, defaultValue: 'active', options: ['active', 'pending', 'void'], index: true },
    ] },
    {
      name: 'reason',
      type: 'select',
      required: true,
      options: [
        { label: 'Cancellation', value: 'cancellation' },
        { label: 'Coach cancellation', value: 'coach_cancellation' },
        { label: 'Goodwill', value: 'goodwill' },
        { label: 'Used at checkout', value: 'used' },
        { label: 'Adjustment', value: 'adjustment' },
      ],
    },
    { name: 'booking', type: 'relationship', relationTo: 'academy-bookings', admin: { description: 'Booking it came from, or was used on' } },
    {
      name: 'scope',
      label: 'Can be used for',
      type: 'select',
      required: true,
      defaultValue: 'any',
      index: true,
      options: [{ label: '1-on-1 sessions', value: 'any' }, { label: 'Small group sessions only', value: 'group' }],
      admin: { description: 'Credits from a small group session can only pay for small group sessions.' },
    },
    { name: 'note', type: 'textarea' },
    { name: 'amount', label: 'Value at the time (AUD)', type: 'number', admin: { readOnly: true, description: 'For reporting only — credits are always worth one session.' } },
    { name: 'createdBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
  ],
}
