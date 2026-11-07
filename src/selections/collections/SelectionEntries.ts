import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { isStaff } from '../../access'
import { birthYearOf, currentSeason, groupLabel } from '../../lib/age-groups'
import { makeReference } from '../../lib/reference'
import { newToken, sendOffer } from '../../lib/trials'

/**
 * One player's expression of interest in a selection round (a tournament, or Rowville trials for a season).
 *
 * Rowville:   Interested → Trial booked → Attended → Successful (offer) / Unsuccessful → Registered (paid)
 * Tournament: Interested → Selected / Unsuccessful → Registered (paid)
 *
 * The age group is the player's year of birth (see lib/age-groups). Staff can place a player in another
 * age group (`playingBirthYear`); every move is logged with who, when and why.
 */
export const SelectionEntries: CollectionConfig = {
  slug: 'selection-entries',
  labels: { singular: 'Interest / selection', plural: 'Interest & selections' },
  admin: {
    group: 'Selections',
    useAsTitle: 'displayName',
    defaultColumns: ['reference', 'player.firstName', 'player.lastName', 'birthYear', 'round', 'status', 'createdAt'],
    listSearchableFields: ['reference', 'player.firstName', 'player.lastName', 'contact.email'],
  },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: '-createdAt',
  hooks: {
    beforeValidate: [
      async ({ data, originalDoc, req, operation }) => {
        if (!data) return data
        const next = { ...data }
        const roundId = next.round ?? originalDoc?.round
        if (roundId && (!next.kind || !next.season)) {
          const round = await req.payload.findByID({ collection: 'selection-rounds', id: typeof roundId === 'object' ? roundId.id : roundId, depth: 0, req, overrideAccess: true })
          next.kind = next.kind ?? round.kind
          next.season = next.season ?? round.season
        }
        if (!next.season && !originalDoc?.season) {
          const settings = await req.payload.findGlobal({ slug: 'site-settings', depth: 0, req })
          next.season = currentSeason(settings.season)
        }
        if (operation === 'create' && !next.reference) next.reference = makeReference(next.kind === 'tournament' ? 'EOI' : 'TRY')
        if (operation === 'create' && !next.token) next.token = newToken()
        const dob = next.player?.dateOfBirth ?? originalDoc?.player?.dateOfBirth
        if (dob) next.birthYear = birthYearOf(dob) ?? next.birthYear
        const first = next.player?.firstName ?? originalDoc?.player?.firstName ?? ''
        const last = next.player?.lastName ?? originalDoc?.player?.lastName ?? ''
        const by = next.playingBirthYear ?? originalDoc?.playingBirthYear ?? next.birthYear ?? originalDoc?.birthYear
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
    { name: 'reference', type: 'text', unique: true, admin: { readOnly: true, description: 'Created automatically when saved' } },
    { name: 'round', type: 'relationship', relationTo: 'selection-rounds', required: true, index: true, admin: { position: 'sidebar' } },
    { name: 'kind', type: 'select', options: ['tournament', 'rowville'], admin: { position: 'sidebar', readOnly: true } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'interested',
      index: true,
      options: [
        { label: 'Interest registered', value: 'interested' },
        { label: 'Trial booked', value: 'trial-booked' },
        { label: 'Attended trial', value: 'attended' },
        { label: 'Selected (tournament)', value: 'selected' },
        { label: 'Successful — offer a place → emails family', value: 'offered' },
        { label: 'Unsuccessful', value: 'unsuccessful' },
        { label: 'Registered & paid', value: 'registered' },
        { label: 'Spot released (unpaid)', value: 'released' },
        { label: 'Withdrawn', value: 'withdrawn' },
        { label: 'Closed', value: 'closed' },
      ],
      admin: { position: 'sidebar' },
    },
    { type: 'row', fields: [
      { name: 'birthYear', label: 'Year of birth (rightful age group)', type: 'number', admin: { readOnly: true } },
      { name: 'playingBirthYear', label: 'Playing in (year of birth group)', type: 'number', admin: { description: 'Set by the selection dashboard when a player is moved' } },
      { name: 'season', type: 'number', admin: { readOnly: true } },
    ] },
    {
      name: 'flags',
      type: 'select',
      hasMany: true,
      options: [{ label: 'Outside MiniRoos ages — check', value: 'outside-miniroos' }],
      admin: { position: 'sidebar' },
    },
    {
      name: 'moves',
      label: 'Age group moves',
      type: 'array',
      admin: { readOnly: true, description: 'Every move between age groups, with who made it and why' },
      fields: [
        { type: 'row', fields: [
          { name: 'from', type: 'number', required: true },
          { name: 'to', type: 'number', required: true },
          { name: 'direction', type: 'select', options: ['up', 'down'] },
          { name: 'steps', type: 'number' },
        ] },
        { name: 'reason', type: 'text', required: true },
        { type: 'row', fields: [
          { name: 'by', type: 'relationship', relationTo: 'users' },
          { name: 'at', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
        ] },
      ],
    },
    {
      type: 'collapsible',
      label: 'Selection',
      admin: { initCollapsed: false },
      fields: [
        { type: 'row', fields: [
          { name: 'squad', type: 'relationship', relationTo: 'squads' },
          {
            name: 'outcomeQueued',
            label: 'Outcome waiting to send',
            type: 'select',
            options: [
              { label: 'Selected', value: 'selected' },
              { label: 'Successful', value: 'successful' },
              { label: 'Unsuccessful', value: 'unsuccessful' },
            ],
            admin: { description: 'Sent from the selection dashboard’s “Review & send”' },
          },
          { name: 'outcomeEmail', label: 'Email the family (unsuccessful)', type: 'checkbox', defaultValue: true },
        ] },
        { type: 'row', fields: [
          { name: 'selectedAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
          { name: 'outcomeSentAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
          { name: 'outcomeSentBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
        ] },
      ],
    },
    { name: 'trialSession', type: 'relationship', relationTo: 'trial-sessions', admin: { position: 'sidebar', condition: (d) => d?.kind !== 'tournament' } },
    {
      type: 'collapsible',
      label: 'Offer a place (Rowville)',
      admin: { initCollapsed: false, condition: (d) => d?.kind !== 'tournament' },
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
        { name: 'previousClub', label: 'Current / previous club', type: 'text' },
        { name: 'notes', type: 'textarea' },
      ],
    },
    { name: 'account', type: 'relationship', relationTo: 'users', index: true, admin: { readOnly: true } },
    { name: 'participant', type: 'relationship', relationTo: 'participants', index: true, admin: { readOnly: true } },
    { name: 'token', type: 'text', admin: { hidden: true }, access: { read: () => false } },
    { name: 'notifiedSessions', type: 'relationship', relationTo: 'trial-sessions', hasMany: true, admin: { readOnly: true, description: 'Trial announcements already emailed' } },
  ],
}
