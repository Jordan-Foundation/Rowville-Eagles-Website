import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access'

/**
 * Single-use links sent by email (create your account, confirm preferences).
 * Only a SHA-256 hash of the token is stored, so a database leak can't be turned into working links.
 */
export const InviteTokens: CollectionConfig = {
  slug: 'invite-tokens',
  admin: { hidden: true, group: 'People', useAsTitle: 'email', defaultColumns: ['email', 'purpose', 'expiresAt', 'usedAt'] },
  access: { read: isAdmin, create: () => false, update: () => false, delete: isAdmin },
  fields: [
    {
      name: 'purpose',
      type: 'select',
      required: true,
      options: [
        { label: 'Create account', value: 'create-account' },
        { label: 'Confirm communication preferences', value: 'confirm-consent' },
        { label: 'Foundation+ free month', value: 'fplus-trial' },
        { label: 'Foundation+ free account', value: 'fplus-join' },
      ],
    },
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
    { name: 'email', type: 'email', required: true },
    { name: 'tokenHash', type: 'text', required: true, unique: true, index: true, admin: { readOnly: true } },
    { name: 'expiresAt', type: 'date', required: true },
    { name: 'usedAt', type: 'date' },
  ],
}
