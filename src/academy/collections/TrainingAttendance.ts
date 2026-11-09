import type { CollectionConfig } from 'payload'
import { isStaff } from '../../access'

/** Who came to a group or team training on a given day (marked by the coach on the training-day screen). */
export const TrainingAttendance: CollectionConfig = {
  slug: 'training-attendance',
  labels: { singular: 'Training attendance', plural: 'Training attendance' },
  admin: { group: 'Foundation Academy', defaultColumns: ['date', 'title', 'presentCount', 'rosterCount', 'takenBy'], useAsTitle: 'title' },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, index: true, admin: { readOnly: true, description: 'group:<slot>:<group>:<date> or team:<team>:<date>' } },
    { name: 'title', type: 'text' },
    { type: 'row', fields: [
      { name: 'kind', type: 'select', required: true, options: ['group', 'team'] },
      { name: 'date', type: 'text', required: true, index: true, admin: { description: 'YYYY-MM-DD' } },
    ] },
    { type: 'row', fields: [
      { name: 'slot', type: 'relationship', relationTo: 'academy-term-slots' },
      { name: 'groupId', type: 'text' },
      { name: 'team', type: 'relationship', relationTo: 'teams' },
    ] },
    { name: 'present', type: 'json', admin: { description: 'Registration ids (groups) or team-member ids (teams) marked present' } },
    { type: 'row', fields: [
      { name: 'presentCount', type: 'number' },
      { name: 'rosterCount', type: 'number' },
    ] },
    { type: 'row', fields: [
      { name: 'takenBy', type: 'relationship', relationTo: 'users' },
      { name: 'takenAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    ] },
  ],
}
