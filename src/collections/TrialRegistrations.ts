import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { isStaff } from '../access'
import { ageGroupOptions } from '../lib/age'
import { sendOffer } from '../lib/trials'

/**
 * "Join us" sign-ups: an expression of interest, or a booked club trial.
 * Committee workflow: Interested → Trial booked → Attended → OFFER A PLACE (pick team + registration) → Registered.
 */
export const TrialRegistrations: CollectionConfig = {
  slug: 'trial-registrations',
  labels: { singular: 'Trial / interest', plural: 'Trials & interest' },
  admin: {
    useAsTitle: 'reference',
    defaultColumns: ['reference', 'player.firstName', 'player.lastName', 'ageGroup', 'status', 'trialSession', 'createdAt'],
    group: 'Trials & Registration',
    listSearchableFields: ['reference', 'player.firstName', 'player.lastName', 'contact.email'],
  },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: '-createdAt',
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        if (data.status === 'offered' && originalDoc?.status !== 'offered' && (!data.offeredTeam || !data.registrationProgram)) {
          throw new APIError('To offer a place, choose the team and the registration program first.', 400, undefined, true)
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req, context }) => {
        if (context.skipOffer) return
        if (doc.status === 'offered' && previousDoc?.status !== 'offered') await sendOffer(req.payload, doc)
      },
    ],
  },
  fields: [
    { name: 'reference', type: 'text', required: true, unique: true, admin: { readOnly: true } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'interested',
      options: [
        { label: 'Interested (waiting for trial dates)', value: 'interested' },
        { label: 'Trial booked', value: 'trial-booked' },
        { label: 'Attended trial', value: 'attended' },
        { label: 'Offer a place → emails family', value: 'offered' },
        { label: 'Registered & paid', value: 'registered' },
        { label: 'Not offered / withdrawn', value: 'closed' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'ageGroup', type: 'select', options: ageGroupOptions, admin: { position: 'sidebar', readOnly: true } },
    { name: 'season', type: 'number', admin: { position: 'sidebar', readOnly: true } },
    { name: 'trialSession', type: 'relationship', relationTo: 'trial-sessions', admin: { position: 'sidebar' } },
    {
      type: 'collapsible',
      label: 'Offer a place',
      admin: { initCollapsed: false },
      fields: [
        { type: 'row', fields: [
          { name: 'offeredTeam', type: 'relationship', relationTo: 'teams' },
          { name: 'registrationProgram', type: 'relationship', relationTo: 'programs', filterOptions: { type: { equals: 'registration' } } },
        ] },
        { name: 'offerSentAt', type: 'date', admin: { readOnly: true } },
      ],
    },
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
        { type: 'row', fields: [{ name: 'firstName', type: 'text', required: true }, { name: 'lastName', type: 'text', required: true }] },
        { type: 'row', fields: [
          { name: 'dateOfBirth', type: 'date', required: true },
          { name: 'gender', type: 'select', options: ['female', 'male', 'non-binary', 'prefer-not-to-say'] },
        ] },
        { name: 'previousClub', type: 'text' },
        { name: 'notes', type: 'textarea' },
      ],
    },
    { name: 'account', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
    { name: 'participant', type: 'relationship', relationTo: 'participants', admin: { readOnly: true } },
    { name: 'token', type: 'text', admin: { hidden: true }, access: { read: () => false } },
    { name: 'notifiedSessions', type: 'relationship', relationTo: 'trial-sessions', hasMany: true, admin: { readOnly: true, description: 'Trial announcements already emailed' } },
  ],
}
