import { heardFromField } from '../../tracking/heard'
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
        // Teams are now built after offers go out, so an offer only needs the registration program
        if (data.status === 'offered' && originalDoc?.status !== 'offered' && !(data.registrationProgram ?? originalDoc?.registrationProgram)) {
          throw new APIError('To offer a place, choose the registration program first.', 400, undefined, true)
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req, context }) => {
        // A trial night booked through the join form goes on the player's trial history (and the attendance list)
        for (const k of ['trialSession', 'trialSession2'] as const) {
          const now = doc[k] && typeof doc[k] === 'object' ? doc[k].id : doc[k]
          const was = previousDoc?.[k] && typeof previousDoc[k] === 'object' ? previousDoc[k].id : previousDoc?.[k]
          if (now && now !== was) {
            const { ensureInvite } = await import('../v2')
            await ensureInvite(req.payload, { entry: doc.id, session: now, source: 'booked' }, req).catch((e) => req.payload.logger.error({ err: e, msg: `Trial history for ${doc.reference}` }))
          }
        }
        if (context.skipOffer) return
        if (doc.status === 'offered' && previousDoc?.status !== 'offered') await sendOffer(req.payload, doc, req)
      },
    ],
  },
  fields: [
    { name: 'source', label: 'Came from', type: 'select', defaultValue: 'web', index: true, options: [{ label: 'Website form', value: 'web' }, { label: 'Imported (old Google form)', value: 'import' }, { label: 'Added by Management', value: 'admin' }], admin: { position: 'sidebar', readOnly: true } },
    heardFromField,
    { name: 'marketingOptIn', label: 'Agreed to news & offers (email + SMS)', type: 'checkbox', admin: { position: 'sidebar', readOnly: true, description: 'From the form they filled in (e.g. the old Google form)' } },
    { name: 'marketingOptInAt', label: 'Agreed on', type: 'date', admin: { position: 'sidebar', readOnly: true, condition: (d) => Boolean(d?.marketingOptIn) } },
    { name: 'marketingWording', label: 'Question they answered', type: 'text', admin: { position: 'sidebar', readOnly: true, condition: (d) => Boolean(d?.marketingOptIn) } },
    { name: 'trialInvitedAt', label: 'Trial dates sent', type: 'date', admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' }, description: 'When the “trial dates are here” email and text went out' } },
    { name: 'trialReminderAt', label: 'Trial reminder sent', type: 'date', admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'referralCode', label: 'Referral code used', type: 'text', index: true, admin: { position: 'sidebar', readOnly: true } },
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
          { name: 'paymentDueAt', label: 'Pay by', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' }, description: 'Set when the outcome is sent; Management can extend it' } },
          { name: 'remindersSent', label: 'Reminders sent (days before)', type: 'number', hasMany: true, admin: { readOnly: true } },
          { name: 'paidAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
          { name: 'releasedAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
        ] },
        { name: 'booking', label: 'Registration payment', type: 'relationship', relationTo: 'bookings', admin: { readOnly: true } },
        { type: 'row', fields: [
          { name: 'selectedAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
          { name: 'outcomeSentAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
          { name: 'outcomeSentBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
        ] },
      ],
    },
    {
      type: 'collapsible',
      label: 'Trials, depth chart & preferences',
      admin: { initCollapsed: true },
      fields: [
        { type: 'row', fields: [
          { name: 'needsAnotherTrial', label: 'Needs another trial', type: 'checkbox', defaultValue: false, index: true },
          { name: 'outcomeMarkedAt', label: 'Outcome marked', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
          { name: 'outcomeMarkedBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
        ] },
        { type: 'row', fields: [
          { name: 'position', label: 'Position (if given)', type: 'text', admin: { description: 'e.g. Goalkeeper, striker' } },
          { name: 'positionGroup', label: 'Depth chart position', type: 'select', options: [{ label: 'GK', value: 'gk' }, { label: 'DEF', value: 'def' }, { label: 'MID', value: 'mid' }, { label: 'FWD', value: 'fwd' }] },
          { name: 'sortOrder', type: 'number', admin: { hidden: true } },
        ] },
        {
          name: 'prefs',
          label: 'Family preferences (after registration)',
          type: 'group',
          admin: { description: 'Can’t be guaranteed — collected to help balance teams' },
          fields: [
            { type: 'row', fields: [
              { name: 'trainingNights', label: 'Training nights', type: 'select', options: [{ label: 'Monday & Wednesday', value: 'mon_wed' }, { label: 'Tuesday & Thursday', value: 'tue_thu' }, { label: 'No preference', value: 'none' }] },
              { name: 'gameDay', label: 'Game day', type: 'select', options: [{ label: 'Saturday', value: 'sat' }, { label: 'Sunday', value: 'sun' }, { label: 'No preference', value: 'none' }] },
              { name: 'answeredAt', type: 'date', admin: { readOnly: true } },
            ] },
          ],
        },
      ],
    },
    { name: 'trialSession', label: 'Trial night', type: 'relationship', relationTo: 'trial-sessions', admin: { position: 'sidebar', condition: (d) => d?.kind !== 'tournament' } },
    { name: 'trialSession2', label: 'Second trial night', type: 'relationship', relationTo: 'trial-sessions', admin: { position: 'sidebar', condition: (d) => d?.kind !== 'tournament' } },
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
