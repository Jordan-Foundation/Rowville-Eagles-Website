import type { CollectionConfig } from 'payload'
import { isStaff } from '../access'

/**
 * A coach asked to work a holiday camp. They confirm or decline from the email/text link or the
 * coach portal; once confirmed, the camp days are blocked out of their 1-on-1 availability.
 */
export const CampCoaches: CollectionConfig = {
  slug: 'camp-coaches',
  labels: { singular: 'Camp coach', plural: 'Camp coaches' },
  admin: { group: 'Programs', defaultColumns: ['coach', 'program', 'status', 'invitedAt'], description: 'Coaches asked to work holiday camps — managed from Management → Holiday camps.' },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: () => false },
  defaultSort: '-invitedAt',
  fields: [
    { type: 'row', fields: [
      { name: 'program', type: 'relationship', relationTo: 'programs', required: true, index: true },
      { name: 'coach', type: 'relationship', relationTo: 'academy-coaches', required: true, index: true },
    ] },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'invited',
      index: true,
      options: [
        { label: 'Waiting for an answer', value: 'invited' },
        { label: 'Confirmed', value: 'confirmed' },
        { label: 'Declined', value: 'declined' },
        { label: 'Removed', value: 'removed' },
      ],
    },
    { name: 'tokenHash', type: 'text', index: true, admin: { hidden: true } },
    { name: 'altTokenHash', type: 'text', index: true, admin: { hidden: true } },
    { type: 'row', fields: [
      { name: 'invitedAt', type: 'date', required: true, admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'remindedAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'escalatedAt', label: 'Management told', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'respondedAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    ] },
    { name: 'declineReason', type: 'textarea' },
    { name: 'declineSeen', type: 'checkbox', defaultValue: false, admin: { description: 'Management has seen this decline' } },
    { name: 'invitedBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
  ],
}
