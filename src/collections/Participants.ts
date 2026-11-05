import type { CollectionConfig } from 'payload'
import { staffOrOwner } from '../access'

/** A player (often a child) managed by an account holder. Foundation for the player development portal. */
export const Participants: CollectionConfig = {
  slug: 'participants',
  admin: {
    useAsTitle: 'fullName',
    defaultColumns: ['fullName', 'dateOfBirth', 'team', 'account'],
    group: 'People',
  },
  access: {
    read: staffOrOwner('account'),
    create: ({ req: { user } }) => Boolean(user),
    update: staffOrOwner('account'),
    delete: staffOrOwner('account'),
  },
  hooks: {
    beforeChange: [
      ({ data }) => ({ ...data, fullName: `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim() }),
    ],
  },
  fields: [
    { name: 'fullName', type: 'text', admin: { hidden: true } },
    {
      type: 'row',
      fields: [
        { name: 'firstName', type: 'text', required: true },
        { name: 'lastName', type: 'text', required: true },
      ],
    },
    { name: 'dateOfBirth', type: 'date', required: true },
    {
      name: 'gender',
      type: 'select',
      options: ['female', 'male', 'non-binary', 'prefer-not-to-say'],
    },
    { name: 'account', type: 'relationship', relationTo: 'users', required: true, label: 'Parent / account holder' },
    { name: 'team', type: 'relationship', relationTo: 'teams' },
    { name: 'ffaNumber', label: 'FFA / PlayFootball number', type: 'text' },
    {
      name: 'medical',
      type: 'group',
      fields: [
        { name: 'conditions', type: 'textarea' },
        { name: 'emergencyContact', type: 'text' },
        { name: 'emergencyPhone', type: 'text' },
      ],
    },
    { name: 'photoConsent', type: 'checkbox', defaultValue: false },
  ],
}
