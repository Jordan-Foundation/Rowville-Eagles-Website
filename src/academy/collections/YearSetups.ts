import type { CollectionConfig } from 'payload'
import { isStaff } from '../../access'

const ymd = { type: 'text', admin: { description: 'YYYY-MM-DD' } } as const

/**
 * Next year's dates, entered each November on Management → Yearly setup. Publishing creates the
 * eight timeframes (Terms 1–4 and the school holidays) and the four Academy term programs.
 */
export const YearSetups: CollectionConfig = {
  slug: 'year-setups',
  labels: { singular: 'Yearly setup', plural: 'Yearly setups' },
  admin: { group: 'Foundation Academy', useAsTitle: 'year', defaultColumns: ['year', 'status', 'publishedAt'], description: 'Use Management → Yearly setup.' },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  fields: [
    { type: 'row', fields: [
      { name: 'year', type: 'number', required: true, unique: true, index: true },
      { name: 'status', type: 'select', required: true, defaultValue: 'draft', options: [{ label: 'Draft', value: 'draft' }, { label: 'Published', value: 'published' }] },
    ] },
    {
      name: 'terms',
      type: 'array',
      maxRows: 4,
      fields: [{ type: 'row', fields: [{ name: 'start', ...ymd }, { name: 'end', ...ymd }, { name: 'deadline', label: 'Availability due', ...ymd }] }],
    },
    {
      name: 'holidays',
      type: 'array',
      maxRows: 4,
      fields: [{ type: 'row', fields: [
        { name: 'period', type: 'select', options: ['summer', 'april', 'mid-year', 'september'] },
        { name: 'start', ...ymd }, { name: 'end', ...ymd }, { name: 'deadline', label: 'Availability due', ...ymd },
      ] }],
    },
    { name: 'term1OpensAt', label: 'Term 1 + full year registrations open', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { type: 'row', fields: [
      { name: 'publishedAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'publishedBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
      { name: 'reminderSentAt', label: 'November reminder sent', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    ] },
    { name: 'results', type: 'json', admin: { readOnly: true, description: 'What publishing created or updated' } },
  ],
}
