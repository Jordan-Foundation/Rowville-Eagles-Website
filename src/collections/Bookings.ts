import type { CollectionConfig } from 'payload'
import { isStaff, staffOrOwner } from '../access'
import { defaultPayee } from './Programs'
import { isPayee, stripeAccounts } from '../lib/stripe-accounts'
import { makeReference } from '../lib/reference'

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
  hooks: {
    // Holiday camps: work the age groups out again when a child is paid for, cancelled or changes days
    afterChange: [
      async ({ doc, previousDoc, req, context }) => {
        if (context?.skipRegroup) return doc
        const changed = doc.status !== previousDoc?.status || JSON.stringify(doc.campDays ?? []) !== JSON.stringify(previousDoc?.campDays ?? []) || doc.keepWith !== previousDoc?.keepWith || doc.player?.dateOfBirth !== previousDoc?.player?.dateOfBirth
        if (!changed || (doc.status !== 'paid' && previousDoc?.status !== 'paid')) return doc
        const programId = typeof doc.program === 'object' ? doc.program?.id : doc.program
        try {
          const program = await req.payload.findByID({ collection: 'programs', id: programId, depth: 0, req, overrideAccess: true, disableErrors: true })
          if (program?.type === 'holiday-camp') await (await import('../camps/groups')).regroupCamp(req.payload, program.id, req)
        } catch (e) {
          req.payload.logger.error({ err: e, msg: 'Could not update the camp groups' })
        }
        return doc
      },
    ],
    beforeValidate: [
      async ({ data, req, operation }) => {
        if (!data || operation !== 'create') return data
        const next = { ...data }
        const programId = typeof next.program === 'object' ? next.program?.id : next.program
        const program = programId ? await req.payload.findByID({ collection: 'programs', id: programId, depth: 0, req, disableErrors: true }) : null
        const payee = next.payee || (program ? (isPayee(program.payee) ? program.payee : defaultPayee(program.type)) : undefined)
        if (payee) next.payee = payee
        if (next.amount === undefined || next.amount === null) next.amount = program?.price ?? 0
        if (!next.reference && isPayee(payee)) next.reference = makeReference(stripeAccounts[payee].refPrefix)
        return next
      },
    ],
  },
  fields: [
    { name: 'reference', type: 'text', unique: true, admin: { readOnly: true, description: 'Created automatically when saved' } },
    { name: 'checkoutGroup', type: 'text', index: true, admin: { readOnly: true, position: 'sidebar', description: 'Brothers and sisters booked together: the reference of the shared checkout.' } },
    { name: 'program', type: 'relationship', relationTo: 'programs', required: true },
    {
      name: 'status', index: true,
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: ['pending', 'paid', 'waitlisted', 'cancelled', 'refunded'],
      admin: { position: 'sidebar' },
    },
    {
      name: 'payee',
      type: 'select',
      required: true,
      options: ['club', 'academy'],
      admin: { position: 'sidebar', description: 'Set from the program automatically' },
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      admin: { position: 'sidebar', description: 'AUD. Defaults to the program price (e.g. for cash bookings).' },
    },
    {
      type: 'row',
      admin: { position: 'sidebar' },
      fields: [
        { name: 'discount', label: 'Promotion discount (AUD)', type: 'number', admin: { readOnly: true, description: 'Already taken off the amount' } },
        { name: 'promotion', type: 'relationship', relationTo: 'promotions', admin: { readOnly: true } },
      ],
    },
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
    { name: 'birthYear', label: 'Age group (year of birth)', type: 'number', admin: { position: 'sidebar' } },
    { name: 'sessionStart', label: 'Booked time slot', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    {
      type: 'collapsible',
      label: 'Holiday camp',
      admin: { initCollapsed: false, condition: (d) => !!d?.fullCamp || (d?.campDays?.length ?? 0) > 0 || !!d?.keepWith },
      fields: [
        { name: 'fullCamp', label: 'Full camp', type: 'checkbox', admin: { description: 'Booked every day of the camp' } },
        {
          name: 'campDays',
          label: 'Days booked',
          type: 'array',
          admin: { description: 'The days this child comes (every day for a full camp)' },
          fields: [{ name: 'day', type: 'text', required: true, admin: { description: 'YYYY-MM-DD' } }],
        },
        { name: 'keepWith', label: 'Keep with (sibling or friend)', type: 'text' },
      ],
    },
    { name: 'account', type: 'relationship', relationTo: 'users' },
    { name: 'participant', type: 'relationship', relationTo: 'participants' },
    { name: 'academyRegistration', label: 'Academy term registration', type: 'relationship', relationTo: 'academy-registrations', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'selectionEntry', label: 'Selection (tournament / trials)', type: 'relationship', relationTo: 'selection-entries', admin: { readOnly: true, position: 'sidebar' } },
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
        { type: 'row', fields: [{ name: 'emergencyName', type: 'text' }, { name: 'emergencyRelationship', label: 'Relationship', type: 'text' }, { name: 'emergencyPhone', type: 'text' }] },
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
