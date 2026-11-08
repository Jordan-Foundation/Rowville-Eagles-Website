import type { CollectionConfig } from 'payload'
import { isStaff, staffOrOwner } from '../../access'
import { weekdayOptions } from '../constants'

/**
 * A family's 1-on-1 booking — a casual one-off or a whole-term weekly slot.
 * Created as `held` at checkout; confirmed only when Stripe confirms payment.
 */
export const AcademyBookings: CollectionConfig = {
  slug: 'academy-bookings',
  labels: { singular: '1-on-1 booking', plural: '1-on-1 bookings' },
  admin: {
    group: 'Foundation Academy',
    useAsTitle: 'reference',
    defaultColumns: ['reference', 'type', 'coach', 'firstSessionAt', 'player.firstName', 'status', 'amount'],
    listSearchableFields: ['reference', 'contact.email', 'player.firstName', 'player.lastName'],
  },
  access: { read: staffOrOwner('account'), create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: '-createdAt',
  fields: [
    { name: 'reference', type: 'text', required: true, unique: true, admin: { readOnly: true } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'held',
      options: [
        { label: 'Held (checkout in progress)', value: 'held' },
        { label: 'Confirmed', value: 'confirmed' },
        { label: 'Payment failed / overdue', value: 'payment_failed' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Refunded', value: 'refunded' },
        { label: 'Expired (not paid in time)', value: 'expired' },
        { label: 'Completed', value: 'completed' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'type', type: 'select', required: true, options: [{ label: 'Casual session', value: 'casual' }, { label: 'Term (weekly)', value: 'term' }], admin: { position: 'sidebar' } },
    { name: 'paymentMode', type: 'select', required: true, options: ['casual', 'upfront', 'weekly'], admin: { position: 'sidebar' } },
    { name: 'amount', type: 'number', required: true, admin: { position: 'sidebar', description: 'AUD (calculated on the server)' } },
    {
      type: 'row',
      admin: { position: 'sidebar' },
      fields: [
        { name: 'discount', label: 'Promotion discount (AUD)', type: 'number', admin: { readOnly: true, description: 'Already taken off the amount' } },
        { name: 'promotion', type: 'relationship', relationTo: 'promotions', admin: { readOnly: true } },
      ],
    },
    { name: 'termMemberPrice', label: 'Term member price', type: 'checkbox', admin: { readOnly: true, position: 'sidebar', description: 'Casual session at the term-member price' } },
    { type: 'row', fields: [
      { name: 'sessionsTotal', type: 'number', defaultValue: 1 },
      { name: 'sessionsPaid', type: 'number', defaultValue: 0 },
    ] },
    { type: 'row', fields: [
      { name: 'coach', type: 'relationship', relationTo: 'academy-coaches', required: true },
      { name: 'term', type: 'relationship', relationTo: 'academy-terms', required: true },
    ] },
    { type: 'row', fields: [
      { name: 'weekday', type: 'select', options: weekdayOptions },
      { name: 'startTime', type: 'text' },
      { name: 'firstSessionAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    ] },
    { name: 'holdExpiresAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    {
      name: 'contact',
      label: 'Parent / guardian',
      type: 'group',
      fields: [
        { type: 'row', fields: [{ name: 'firstName', type: 'text', required: true }, { name: 'lastName', type: 'text', required: true }] },
        { type: 'row', fields: [{ name: 'email', type: 'email', required: true }, { name: 'mobile', type: 'text', required: true }] },
      ],
    },
    {
      name: 'player',
      type: 'group',
      fields: [
        { type: 'row', fields: [{ name: 'firstName', type: 'text', required: true }, { name: 'lastName', type: 'text', required: true }, { name: 'dateOfBirth', type: 'date', required: true }] },
        { type: 'row', fields: [{ name: 'currentClub', type: 'text' }, { name: 'position', type: 'text' }] },
        { name: 'goals', label: 'Main goals for the sessions', type: 'textarea' },
        { name: 'medical', label: 'Medical / injury notes', type: 'textarea' },
        { type: 'row', fields: [{ name: 'emergencyName', type: 'text', required: true }, { name: 'emergencyPhone', type: 'text', required: true }] },
        { name: 'photoConsent', type: 'checkbox' },
      ],
    },
    { type: 'row', fields: [
      { name: 'account', type: 'relationship', relationTo: 'users' },
      { name: 'participant', type: 'relationship', relationTo: 'participants' },
    ] },
    { name: 'marketingOptIn', label: 'Ticked marketing opt-in at checkout', type: 'checkbox', admin: { readOnly: true } },
    { name: 'source', type: 'select', defaultValue: 'web', options: ['web', 'coach-link', 'admin'], admin: { position: 'sidebar' } },
    {
      type: 'collapsible',
      label: 'Weekly payment plan',
      admin: { condition: (data) => data?.paymentMode === 'weekly', initCollapsed: false },
      fields: [
        { type: 'row', fields: [
          { name: 'nextChargeAt', label: 'Next automatic charge', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
          { name: 'chargeAnchorAt', label: 'First automatic charge', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
        ] },
        {
          name: 'payments',
          type: 'array',
          admin: { readOnly: true, description: 'Every weekly charge, written by the Stripe webhook.' },
          fields: [
            { type: 'row', fields: [
              { name: 'invoiceId', type: 'text', required: true },
              { name: 'status', type: 'select', required: true, options: ['paid', 'failed'] },
              { name: 'amount', type: 'number' },
              { name: 'at', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
            ] },
            { name: 'payUrl', label: 'Stripe payment page (for a failed charge)', type: 'text' },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Refunds, credit & cancellations',
      admin: { initCollapsed: false, description: 'Cancel or refund from Management → Academy → Bookings, which applies the policy and talks to Stripe.' },
      fields: [
        { type: 'row', fields: [
          { name: 'creditSessionsUsed', label: 'Session credits used', type: 'number', defaultValue: 0, admin: { readOnly: true } },
          { name: 'creditApplied', label: 'Value of credits used (AUD)', type: 'number', defaultValue: 0, admin: { readOnly: true } },
          { name: 'refundedAmount', label: 'Refunded to card', type: 'number', defaultValue: 0, admin: { readOnly: true } },
          { name: 'creditedSessions', label: 'Session credits given', type: 'number', defaultValue: 0, admin: { readOnly: true } },
          { name: 'creditedAmount', label: 'Value of credits given (AUD)', type: 'number', defaultValue: 0, admin: { readOnly: true } },
        ] },
        {
          name: 'adjustments',
          type: 'array',
          admin: { readOnly: true },
          fields: [
            { type: 'row', fields: [
              { name: 'key', type: 'text', required: true },
              { name: 'action', type: 'select', required: true, options: ['cancel_booking', 'cancel_sessions', 'makeup', 'goodwill', 'reschedule'] },
              { name: 'by', type: 'select', options: ['family', 'coach', 'admin'] },
              { name: 'outcome', type: 'select', options: ['refund', 'credit', 'makeup', 'none'] },
            ] },
            { type: 'row', fields: [
              { name: 'sessions', label: 'Sessions', type: 'text' },
              { name: 'cash', label: 'Refund (AUD)', type: 'number' },
              { name: 'credit', label: 'Credit value (AUD)', type: 'number' },
              { name: 'creditSessions', label: 'Session credits', type: 'number' },
              { name: 'refundStatus', type: 'select', options: ['none', 'pending', 'refunded', 'failed', 'simulated'] },
            ] },
            { name: 'rule', type: 'text' },
            { name: 'reason', type: 'textarea' },
            { name: 'stripeRefundIds', type: 'text' },
            { name: 'error', type: 'text' },
            { type: 'row', fields: [
              { name: 'actor', type: 'relationship', relationTo: 'users' },
              { name: 'at', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
            ] },
          ],
        },
      ],
    },
    { name: 'stripeCheckoutId', type: 'text', admin: { readOnly: true } },
    { name: 'stripeScheduleId', label: 'Stripe subscription schedule (weekly plan)', type: 'text', admin: { readOnly: true } },
    { name: 'stripeSubscriptionId', type: 'text', index: true, admin: { readOnly: true } },
    { name: 'stripeCustomerId', type: 'text', admin: { readOnly: true } },
    { name: 'organisation', type: 'text', defaultValue: 'rowville', admin: { readOnly: true, position: 'sidebar' } },
  ],
}
