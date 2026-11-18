import type { CollectionConfig } from 'payload'
import { isStaff } from '../../access'

/** Every trial a player has been invited to (or booked), and whether they came. One row per player per trial. */
export const TrialInvites: CollectionConfig = {
  slug: 'trial-invites',
  labels: { singular: 'Trial invite', plural: 'Trial invites' },
  admin: { group: 'Selections', defaultColumns: ['entry', 'session', 'invitedAt', 'attended'] },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  fields: [
    { name: 'key', type: 'text', unique: true, index: true, admin: { readOnly: true, description: '<entry>-<session>' } },
    { type: 'row', fields: [
      { name: 'entry', type: 'relationship', relationTo: 'selection-entries', required: true, index: true },
      { name: 'session', type: 'relationship', relationTo: 'trial-sessions', required: true, index: true },
    ] },
    { type: 'row', fields: [
      { name: 'source', type: 'select', defaultValue: 'invited', options: [{ label: 'Booked by the family', value: 'booked' }, { label: 'Invited by Management', value: 'invited' }] },
      { name: 'invitedAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'invitedBy', type: 'relationship', relationTo: 'users' },
    ] },
    { type: 'row', fields: [
      { name: 'attended', type: 'checkbox', defaultValue: false, index: true },
      { name: 'attendedAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'markedBy', type: 'relationship', relationTo: 'users' },
    ] },
  ],
}
