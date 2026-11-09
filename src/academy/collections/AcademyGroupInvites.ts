import type { CollectionConfig } from 'payload'
import { isStaff } from '../../access'

/**
 * One player's place in a small group: their own link (only a hash of its secret is stored), their
 * locked price, and — once they pay — their own academy-bookings row. Families never see each other's
 * invites; the invite page only shows the other players' first names.
 */
export const AcademyGroupInvites: CollectionConfig = {
  slug: 'academy-group-invites',
  labels: { singular: 'Small group place', plural: 'Small group places' },
  admin: {
    group: 'Foundation Academy',
    useAsTitle: 'label',
    defaultColumns: ['label', 'group', 'status', 'rateLocked', 'booking'],
  },
  access: { read: isStaff, create: () => false, update: isStaff, delete: () => false },
  defaultSort: 'createdAt',
  hooks: {
    beforeChange: [({ data }) => {
      const i = data?.invitee
      if (data && i) data.label = [`${i.playerFirstName ?? ''} ${i.playerLastName ?? ''}`.trim(), i.parentFirstName && `(${i.parentFirstName} ${i.parentLastName ?? ''})`.trim()].filter(Boolean).join(' ')
      return data
    }],
  },
  fields: [
    { name: 'label', type: 'text', admin: { readOnly: true } },
    { name: 'group', type: 'relationship', relationTo: 'academy-groups', required: true, index: true },
    { name: 'tokenHash', type: 'text', required: true, unique: true, index: true, admin: { hidden: true } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'invited',
      index: true,
      options: [
        { label: 'Invited', value: 'invited' },
        { label: 'Paid', value: 'paid' },
        { label: 'Paying weekly', value: 'weekly' },
        { label: 'Overdue', value: 'overdue' },
        { label: 'Declined', value: 'declined' },
        { label: 'Removed', value: 'removed' },
      ],
      admin: { position: 'sidebar' },
    },
    { type: 'row', fields: [
      { name: 'participant', type: 'relationship', relationTo: 'participants' },
      { name: 'account', type: 'relationship', relationTo: 'users', index: true },
    ] },
    {
      name: 'invitee',
      label: 'Player and parent',
      type: 'group',
      fields: [
        { type: 'row', fields: [
          { name: 'playerFirstName', type: 'text', required: true },
          { name: 'playerLastName', type: 'text', required: true },
        ] },
        { type: 'row', fields: [
          { name: 'parentFirstName', type: 'text', required: true },
          { name: 'parentLastName', type: 'text', required: true },
        ] },
        { type: 'row', fields: [
          { name: 'email', type: 'email', required: true },
          { name: 'mobile', type: 'text' },
        ] },
      ],
    },
    { type: 'row', fields: [
      { name: 'rateLocked', label: 'Price per session (AUD)', type: 'number', required: true, admin: { readOnly: true } },
      { name: 'booking', type: 'relationship', relationTo: 'academy-bookings', index: true, admin: { readOnly: true } },
    ] },
    { type: 'row', fields: [
      { name: 'sentEmail', type: 'checkbox', admin: { readOnly: true } },
      { name: 'sentSms', type: 'checkbox', admin: { readOnly: true } },
      { name: 'openedAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'remindedAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    ] },
    { name: 'termAnswer', label: 'Term offer answer', type: 'select', defaultValue: 'pending', options: ['pending', 'accepted', 'declined'] },
  ],
}
