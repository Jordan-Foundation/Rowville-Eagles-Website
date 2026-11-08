import type { CollectionConfig } from 'payload'
import { isStaff } from '../../../access'

/** A round of player reports, e.g. "Mid-year 2027": which programs/teams it covers and when coaches must finish. */
export const ReportCycles: CollectionConfig = {
  slug: 'report-cycles',
  labels: { singular: 'Report cycle', plural: 'Report cycles' },
  admin: { group: 'Reports', useAsTitle: 'name', defaultColumns: ['name', 'dueDate', 'status', 'reportsCreatedAt'], description: 'Easiest from Management → Reports.' },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: '-createdAt',
  fields: [
    { type: 'row', fields: [
      { name: 'name', type: 'text', required: true, admin: { placeholder: 'e.g. Mid-year 2027' } },
      { name: 'season', type: 'number', required: true, admin: { description: 'Season year — sets each player’s age level (season − year of birth)' } },
      { name: 'dueDate', label: 'Coaches finish by', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
    ] },
    { name: 'status', type: 'select', required: true, defaultValue: 'open', options: [{ label: 'Open', value: 'open' }, { label: 'Closed', value: 'closed' }], admin: { position: 'sidebar', description: 'Closed cycles stop sending reminders.' } },
    { name: 'programs', label: 'Academy term programs', type: 'relationship', relationTo: 'programs', hasMany: true, filterOptions: { type: { equals: 'academy-term' } } },
    { name: 'teams', label: 'Rowville & tournament teams', type: 'relationship', relationTo: 'teams', hasMany: true },
    { name: 'reportsCreatedAt', label: 'Reports last created', type: 'date', admin: { readOnly: true, position: 'sidebar' } },
  ],
}
