import type { CollectionConfig } from 'payload'
import { isStaff } from '../../../access'
import { birthYearOf, groupLabel } from '../../../lib/age-groups'
import { makeReference } from '../../../lib/reference'
import { newToken } from '../../../lib/trials'

/**
 * A player's place in an Academy term program.
 *   interest → (staff offer a slot) offered → pending_payment → paid
 *   pending_payment → paid  (family chose a slot at booking)
 *   any → cancelled
 */
export const AcademyRegistrations: CollectionConfig = {
  slug: 'academy-registrations',
  labels: { singular: 'Term registration', plural: 'Term registrations' },
  admin: {
    group: 'Foundation Academy',
    useAsTitle: 'displayName',
    defaultColumns: ['reference', 'displayName', 'program', 'slot', 'status', 'createdAt'],
    listSearchableFields: ['reference', 'player.firstName', 'player.lastName', 'contact.email'],
  },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: '-createdAt',
  hooks: {
    beforeValidate: [
      ({ data, originalDoc, operation }) => {
        if (!data) return data
        if (operation === 'create' && !data.reference) data.reference = makeReference('TRM')
        if (operation === 'create' && !data.token) data.token = newToken()
        const dob = data.player?.dateOfBirth ?? originalDoc?.player?.dateOfBirth
        if (dob) data.birthYear = birthYearOf(dob) ?? data.birthYear
        const first = data.player?.firstName ?? originalDoc?.player?.firstName ?? ''
        const last = data.player?.lastName ?? originalDoc?.player?.lastName ?? ''
        const by = data.playingBirthYear ?? originalDoc?.playingBirthYear ?? data.birthYear ?? originalDoc?.birthYear
        data.displayName = `${first} ${last}`.trim() + (by ? ` (${groupLabel(by)})` : '')
        return data
      },
    ],
  },
  fields: [
    { name: 'displayName', type: 'text', admin: { hidden: true } },
    { name: 'reference', type: 'text', unique: true, admin: { readOnly: true, position: 'sidebar' } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'interest',
      index: true,
      options: [
        { label: 'Interest (no slot yet)', value: 'interest' },
        { label: 'Offered a slot', value: 'offered' },
        { label: 'Awaiting payment', value: 'pending_payment' },
        { label: 'Paid', value: 'paid' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'program', type: 'relationship', relationTo: 'programs', required: true, index: true },
    { name: 'slot', type: 'relationship', relationTo: 'academy-term-slots', index: true },
    { name: 'groupId', label: 'Group', type: 'text', admin: { description: 'Group within the slot (set on the staff dashboard)' } },
    {
      type: 'row',
      fields: [
        { name: 'nights', label: 'Nights a week', type: 'select', defaultValue: '1', options: [{ label: '1 night', value: '1' }, { label: '2 nights', value: '2' }] },
        { name: 'pairedWith', label: 'Other night', type: 'relationship', relationTo: 'academy-registrations', admin: { description: '2 nights a week: the registration for the other night (paid together)' } },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'birthYear', label: 'Year of birth', type: 'number', index: true, admin: { readOnly: true } },
        { name: 'playingBirthYear', label: 'Playing in (year of birth)', type: 'number', admin: { description: 'Only when placed outside their own age group' } },
        { name: 'amount', label: 'Price (AUD)', type: 'number' },
      ],
    },
    {
      name: 'moves',
      type: 'array',
      admin: { readOnly: true },
      fields: [
        { name: 'from', type: 'text' },
        { name: 'to', type: 'text' },
        { name: 'reason', type: 'text' },
        { name: 'by', type: 'relationship', relationTo: 'users' },
        { name: 'at', type: 'date' },
      ],
    },
    {
      name: 'contact',
      label: 'Parent / guardian',
      type: 'group',
      fields: [
        { type: 'row', fields: [{ name: 'firstName', type: 'text', required: true }, { name: 'lastName', type: 'text', required: true }] },
        { type: 'row', fields: [{ name: 'email', type: 'email', required: true, index: true }, { name: 'phone', type: 'text', required: true }] },
      ],
    },
    {
      name: 'player',
      type: 'group',
      fields: [
        { type: 'row', fields: [{ name: 'firstName', type: 'text', required: true }, { name: 'lastName', type: 'text', required: true }, { name: 'dateOfBirth', type: 'date', required: true }] },
        { name: 'medical', type: 'textarea' },
        { type: 'row', fields: [{ name: 'emergencyName', type: 'text' }, { name: 'emergencyPhone', type: 'text' }] },
        { name: 'photoConsent', type: 'checkbox' },
      ],
    },
    { name: 'account', type: 'relationship', relationTo: 'users', index: true },
    { name: 'participant', type: 'relationship', relationTo: 'participants', index: true },
    { name: 'booking', label: 'Payment', type: 'relationship', relationTo: 'bookings', admin: { readOnly: true } },
    {
      type: 'row',
      fields: [
        { name: 'offeredAt', type: 'date', admin: { readOnly: true } },
        { name: 'offerExpiresAt', label: 'Offer held until', type: 'date' },
        { name: 'paidAt', type: 'date', admin: { readOnly: true } },
      ],
    },
    { name: 'notes', label: 'Staff notes', type: 'textarea' },
    { name: 'token', type: 'text', admin: { hidden: true }, access: { read: () => false } },
  ],
}
