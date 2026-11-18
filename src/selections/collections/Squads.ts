import type { CollectionConfig } from 'payload'
import { isStaff } from '../../access'
import { groupLabel } from '../../lib/age-groups'

/** A team within a selection round, e.g. "2016s Red" / "2016s Blue". Several per age group are fine. */
export const Squads: CollectionConfig = {
  slug: 'squads',
  labels: { singular: 'Squad', plural: 'Squads' },
  admin: { group: 'Selections', useAsTitle: 'name', defaultColumns: ['name', 'round', 'birthYears', 'capacity'] },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (data && !data.name && data.birthYears?.length) data.name = data.birthYears.map((y: number) => groupLabel(y)).join(' / ')
        return data
      },
    ],
  },
  fields: [
    { name: 'round', type: 'relationship', relationTo: 'selection-rounds', required: true, index: true },
    { name: 'name', type: 'text', required: true },
    { type: 'row', fields: [
      { name: 'birthYears', label: 'Age groups (years of birth)', type: 'number', hasMany: true },
      { name: 'capacity', type: 'number', min: 1 },
      { name: 'fee', label: 'Fee override (AUD)', type: 'number', min: 0, admin: { description: 'Leave blank to use the round’s fee' } },
    ] },
    { name: 'coaches', type: 'relationship', relationTo: 'users', hasMany: true, filterOptions: { roles: { in: ['coach', 'admin', 'committee'] } } },
    { name: 'team', type: 'relationship', relationTo: 'teams', admin: { description: 'The club team / tournament team page players join once the team is finalised' } },
    { name: 'sortOrder', type: 'number', admin: { hidden: true } },
    {
      type: 'collapsible',
      label: 'Coach welcome & finalising',
      fields: [
        { name: 'welcomeMessage', label: 'Coach welcome message', type: 'textarea', maxLength: 600, admin: { description: 'Written by the coach in the coach portal (Management can edit). Goes in the team email.' } },
        { type: 'row', fields: [
          { name: 'welcomeUpdatedBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
          { name: 'welcomeUpdatedAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
        ] },
        { type: 'row', fields: [
          { name: 'finalisedAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
          { name: 'finalisedBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
          { name: 'teamEmailSentAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
        ] },
      ],
    },
  ],
}
