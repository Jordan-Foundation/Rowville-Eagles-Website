import type { CollectionConfig } from 'payload'
import { isStaff, staffOrOwner } from '../../access'

/**
 * Account credit ledger (AUD). Positive = credit given, negative = credit used.
 * Balance = sum of `active` + `pending` rows. A checkout reserves credit as `pending`; it becomes
 * `active` when paid and `void` if the checkout is abandoned. Rows are never deleted.
 */
export const AcademyCredits: CollectionConfig = {
  slug: 'academy-credits',
  labels: { singular: 'Account credit', plural: 'Account credit' },
  admin: {
    group: 'Foundation Academy',
    defaultColumns: ['account', 'amount', 'reason', 'status', 'booking', 'createdAt'],
    description: 'Credit given for cancellations (and used at checkout). Give goodwill credit from a booking’s page in Staff → Academy.',
  },
  access: { read: staffOrOwner('account'), create: isStaff, update: isStaff, delete: () => false },
  defaultSort: '-createdAt',
  fields: [
    { name: 'account', type: 'relationship', relationTo: 'users', required: true, index: true },
    { type: 'row', fields: [
      { name: 'amount', type: 'number', required: true, admin: { description: 'AUD. Positive = given, negative = used.' } },
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
    { name: 'note', type: 'textarea' },
    { name: 'createdBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
  ],
}
