import type { CollectionConfig } from 'payload'
import { anyone, isStaff } from '../access'

export const teamCategories = [
  { label: 'MiniRoos', value: 'miniroos' },
  { label: 'Junior Boys', value: 'junior-boys' },
  { label: 'Junior Girls', value: 'junior-girls' },
  { label: 'Senior Women', value: 'senior-women' },
  { label: 'Senior Men', value: 'senior-men' },
] as const

export const Teams: CollectionConfig = {
  slug: 'teams',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'category', 'ageGroup'], group: 'Club' },
  access: { read: anyone, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: 'order',
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'category', type: 'select', required: true, options: [...teamCategories] },
    { name: 'ageGroup', type: 'text', admin: { description: 'e.g. U7, U12, Seniors, Reserves' } },
    { name: 'competition', type: 'text', admin: { description: 'League / division' } },
    { name: 'trainingTimes', type: 'text' },
    { name: 'coaches', type: 'relationship', relationTo: 'users', hasMany: true },
    {
      name: 'driblUrl',
      label: 'Dribl fixtures link',
      type: 'text',
      admin: { description: 'Link to this team’s fixtures page on Dribl (shown on the Fixtures page).' },
    },
    {
      name: 'driblTeamId',
      type: 'text',
      admin: { description: 'Dribl team identifier — used to pull fixtures & results automatically.' },
    },
    { name: 'photo', type: 'upload', relationTo: 'media' },
    { name: 'order', type: 'number', defaultValue: 0 },
  ],
}
