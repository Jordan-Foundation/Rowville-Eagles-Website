import type { CollectionConfig } from 'payload'
import { isStaff, staffOrOwner } from '../../access'

/** A paid player on a team. Added automatically when registration is paid; families see the team page while active. */
export const TeamMembers: CollectionConfig = {
  slug: 'team-members',
  labels: { singular: 'Team member', plural: 'Team members' },
  admin: { group: 'Club', defaultColumns: ['participant', 'team', 'account', 'active', 'source'] },
  access: { read: staffOrOwner('account'), create: isStaff, update: isStaff, delete: isStaff },
  fields: [
    { type: 'row', fields: [
      { name: 'team', type: 'relationship', relationTo: 'teams', required: true, index: true },
      { name: 'participant', type: 'relationship', relationTo: 'participants', required: true, index: true },
      { name: 'account', label: 'Parent / account', type: 'relationship', relationTo: 'users', required: true, index: true },
    ] },
    { type: 'row', fields: [
      { name: 'active', type: 'checkbox', defaultValue: true },
      { name: 'source', type: 'select', defaultValue: 'admin', options: [{ label: 'Paid selection', value: 'selection' }, { label: 'Club registration', value: 'registration' }, { label: 'Added by admin', value: 'admin' }] },
      { name: 'selectionEntry', type: 'relationship', relationTo: 'selection-entries' },
    ] },
  ],
}
