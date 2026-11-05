import type { CollectionConfig } from 'payload'
import { isStaff, staffOrOwner } from '../access'
import { ageGroupOptions } from '../lib/age'

/**
 * A place in a Program. Created by the checkout flow (pending) and confirmed by the Stripe webhook (paid).
 * Guests can book without an account: contact + player details are stored on the booking, and the
 * portal (Phase 6) links bookings to an account once the email address is verified.
 */
export const Bookings: CollectionConfig = {
  slug: 'bookings',
  admin: {
    useAsTitle: 'reference',
    defaultColumns: ['reference', 'program', 'player.firstName', 'player.lastName', 'status', 'amount', 'createdAt'],
    group: 'Programs & Bookings',
  },
  access: { read: staffOrOwner('account'), create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: '-createdAt',
  fields: [
    { name: 'reference', type: 'text', required: true, unique: true, admin: { readOnly: true } },
    { name: 'program', type: 'relationship', relationTo: 'programs', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: ['pending', 'paid', 'waitlisted', 'cancelled', 'refunded'],
      admin: { position: 'sidebar' },
    },
    { name: 'payee', type: 'select', required: true, options: ['club', 'academy'], admin: { readOnly: true, position: 'sidebar' } },
    { name: 'amount', type: 'number', required: true, admin: { readOnly: true, position: 'sidebar', description: 'AUD' } },
    {
      name: 'bookingType',
      type: 'select',
      defaultValue: 'enrolment',
      options: [
        { label: 'Enrolment / booking', value: 'enrolment' },
        { label: 'Trial session', value: 'trial' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'ageGroup', type: 'select', options: ageGroupOptions, admin: { position: 'sidebar' } },
    { name: 'sessionStart', label: 'Booked time slot', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'account', type: 'relationship', relationTo: 'users' },
    { name: 'participant', type: 'relationship', relationTo: 'participants' },
    {
      name: 'contact',
      label: 'Parent / contact',
      type: 'group',
      fields: [
        { type: 'row', fields: [{ name: 'firstName', type: 'text', required: true }, { name: 'lastName', type: 'text', required: true }] },
        { type: 'row', fields: [{ name: 'email', type: 'email', required: true }, { name: 'phone', type: 'text', required: true }] },
      ],
    },
    {
      name: 'player',
      type: 'group',
      fields: [
        { type: 'row', fields: [{ name: 'firstName', type: 'text' }, { name: 'lastName', type: 'text' }, { name: 'dateOfBirth', type: 'date' }] },
        { name: 'teamName', type: 'text', admin: { description: 'Tournament entries' } },
        { name: 'medical', type: 'textarea' },
        { type: 'row', fields: [{ name: 'emergencyName', type: 'text' }, { name: 'emergencyPhone', type: 'text' }] },
        { name: 'photoConsent', type: 'checkbox' },
      ],
    },
    { name: 'stripeCheckoutId', type: 'text', admin: { readOnly: true } },
    {
      name: 'playFootballComplete',
      type: 'checkbox',
      admin: { description: 'Season registrations: FV section completed in PlayFootball' },
    },
  ],
}
