import type { CollectionConfig } from 'payload'
import { isStaff } from '../access'

/** RFA tournaments: Management invites RFA players into squads; families accept or decline (and pay any fee). */
export const RfaTournaments: CollectionConfig = {
  slug: 'rfa-tournaments',
  labels: { singular: 'RFA tournament', plural: 'RFA tournaments' },
  admin: { group: 'Foundation Academy', useAsTitle: 'name', defaultColumns: ['name', 'startDate', 'venue', 'rsvpDeadline'] },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: '-startDate',
  fields: [
    { name: 'name', type: 'text', required: true },
    { type: 'row', fields: [
      { name: 'startDate', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
      { name: 'endDate', type: 'date', admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
    ] },
    { type: 'row', fields: [
      { name: 'venue', type: 'text' },
      { name: 'ageGroups', label: 'Age group(s)', type: 'text', admin: { placeholder: 'U10, U11' } },
    ] },
    { type: 'row', fields: [
      { name: 'squadSize', label: 'Squad size limit', type: 'number', required: true, defaultValue: 10, min: 1, max: 40 },
      { name: 'fee', label: 'Fee per player (AUD, optional)', type: 'number', min: 0 },
      { name: 'rsvpDeadline', label: 'RSVP by', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    ] },
    { name: 'arrivalTime', label: 'Arrival time', type: 'text', admin: { placeholder: 'Arrive 8:15am for a 9am first game' } },
    { name: 'whatToBring', label: 'What to bring', type: 'textarea' },
    { name: 'details', type: 'textarea' },
  ],
}

export const TournamentSquads: CollectionConfig = {
  slug: 'tournament-squads',
  labels: { singular: 'Tournament squad', plural: 'Tournament squads' },
  admin: { group: 'Foundation Academy', useAsTitle: 'name', defaultColumns: ['name', 'tournament', 'limit'] },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  fields: [
    { name: 'tournament', type: 'relationship', relationTo: 'rfa-tournaments', required: true, index: true },
    { name: 'name', type: 'text', required: true, admin: { placeholder: 'U11 Squad A' } },
    { name: 'birthYears', label: 'Years of birth', type: 'number', hasMany: true, admin: { description: 'Used to suggest players' } },
    { name: 'limit', label: 'Squad size (blank = the tournament’s)', type: 'number', min: 1, max: 40 },
  ],
}

export const INVITE_STATUSES = ['invited', 'accepted', 'declined', 'expired', 'paid', 'withdrawn'] as const

export const TournamentInvites: CollectionConfig = {
  slug: 'tournament-invites',
  labels: { singular: 'Tournament invite', plural: 'Tournament invites' },
  admin: { group: 'Foundation Academy', useAsTitle: 'playerName', defaultColumns: ['playerName', 'squad', 'status', 'invitedAt'] },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  indexes: [{ fields: ['squad', 'participant'], unique: true }],
  fields: [
    { name: 'tournament', type: 'relationship', relationTo: 'rfa-tournaments', required: true, index: true },
    { name: 'squad', type: 'relationship', relationTo: 'tournament-squads', required: true, index: true },
    { name: 'participant', label: 'Player', type: 'relationship', relationTo: 'participants', required: true, index: true },
    { name: 'account', label: 'Family', type: 'relationship', relationTo: 'users', index: true },
    { type: 'row', fields: [
      { name: 'playerName', type: 'text' },
      { name: 'birthYear', type: 'number' },
    ] },
    { name: 'status', type: 'select', required: true, defaultValue: 'invited', index: true, options: [
      { label: 'Invited', value: 'invited' }, { label: 'Accepted (fee to pay)', value: 'accepted' }, { label: 'Declined', value: 'declined' },
      { label: 'Expired (no reply by the deadline)', value: 'expired' }, { label: 'Confirmed / paid', value: 'paid' }, { label: 'Withdrawn by Management', value: 'withdrawn' },
    ] },
    { name: 'token', type: 'text', required: true, unique: true, index: true, admin: { hidden: true } },
    { type: 'row', fields: [
      { name: 'invitedAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'respondedAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'reminderAt', label: 'Reminder sent', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'paidAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    ] },
    { name: 'invoice', type: 'relationship', relationTo: 'invoices', admin: { readOnly: true } },
    { name: 'invitedBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
  ],
}
