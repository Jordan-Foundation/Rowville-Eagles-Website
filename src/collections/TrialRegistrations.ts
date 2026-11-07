import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { isStaff } from '../access'
import { birthYearOf, currentSeason, groupLabel } from '../lib/age-groups'
import { makeReference } from '../lib/reference'
import { newToken, sendOffer } from '../lib/trials'

/**
 * "Join us" sign-ups: an expression of interest, or a booked club trial.
 * Committee workflow: Interested → Trial booked → Attended → OFFER A PLACE (pick team + registration) → Registered.
 */
export const TrialRegistrations: CollectionConfig = {
  slug: 'trial-registrations',
  labels: { singular: 'Trial / interest', plural: 'Trials & interest' },
  admin: {
    useAsTitle: 'displayName',
    defaultColumns: ['reference', 'player.firstName', 'player.lastName', 'birthYear', 'status', 'trialSession', 'createdAt'],
    group: 'Trials & Registration',
    listSearchableFields: ['reference', 'player.firstName', 'player.lastName', 'contact.email'],
  },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: '-createdAt',
  hooks: {
    beforeValidate: [
      async ({ data, originalDoc, req, operation }) => {
        if (!data) return data
        const next = { ...data }
        if (operation === 'create' && !next.reference) next.reference = makeReference('TRY')
        if (operation === 'create' && !next.token) next.token = newToken()
        if (!next.season && !originalDoc?.season) {
          const settings = await req.payload.findGlobal({ slug: 'site-settings', depth: 0, req })
          next.season = currentSeason(settings.season)
        }
        const dob = next.player?.dateOfBirth ?? originalDoc?.player?.dateOfBirth
        if (dob) next.birthYear = birthYearOf(dob) ?? next.birthYear
        const first = next.player?.firstName ?? originalDoc?.player?.firstName ?? ''
        const last = next.player?.lastName ?? originalDoc?.player?.lastName ?? ''
        const by = next.birthYear ?? originalDoc?.birthYear
        next.displayName = `${first} ${last}`.trim() + (by ? ` (${groupLabel(by)})` : '')
        return next
      },
    ],
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
        if (doc.status === 'offered' && previousDoc?.status !== 'offered') await sendOffer(req.payload, doc, req)
      },
    ],
  },
  fields: [
    { name: 'displayName', type: 'text', admin: { hidden: true } },
    {
      name: 'reference',
      type: 'text',
      unique: true,
      admin: { readOnly: true, description: 'Created automatically when saved' },
    },
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
    {
      name: 'birthYear',
      label: 'Age group (year of birth)',
      type: 'number',
      admin: { position: 'sidebar', readOnly: true, description: 'From the date of birth — the age group is shown as e.g. “2017s”' },
    },
    { name: 'season', type: 'number', admin: { position: 'sidebar', readOnly: true, description: 'Set automatically' } },
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
