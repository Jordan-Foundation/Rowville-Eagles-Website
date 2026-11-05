import type { CollectionConfig } from 'payload'
import { isStaff, staffOrOwner } from '../access'

/** A paid (or pending) place in a Program for a Participant. Powers the portal calendar. */
export const Bookings: CollectionConfig = {
  slug: 'bookings',
  admin: {
    useAsTitle: 'reference',
    defaultColumns: ['reference', 'program', 'participant', 'status', 'amount'],
    group: 'Programs & Bookings',
  },
  access: {
    read: staffOrOwner('account'),
    // Created server-side by the checkout flow (Stripe webhook) — not directly by the public.
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  fields: [
    { name: 'reference', type: 'text', required: true, unique: true },
    { name: 'program', type: 'relationship', relationTo: 'programs', required: true },
    { name: 'participant', type: 'relationship', relationTo: 'participants', required: true },
    { name: 'account', type: 'relationship', relationTo: 'users', required: true },
    { name: 'sessionStart', type: 'date', admin: { description: 'For 1-on-1s / trials: the booked slot' } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: ['pending', 'paid', 'waitlisted', 'cancelled', 'refunded'],
    },
    { name: 'amount', type: 'number', required: true, admin: { description: 'AUD charged' } },
    { name: 'stripeCheckoutId', type: 'text', admin: { readOnly: true } },
    {
      name: 'playFootballComplete',
      type: 'checkbox',
      admin: { description: 'Season registrations: FV section completed in PlayFootball' },
    },
  ],
}
