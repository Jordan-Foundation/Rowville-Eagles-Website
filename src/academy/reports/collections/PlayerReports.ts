import type { CollectionConfig } from 'payload'
import { isStaff } from '../../../access'
import { LEVELS, RATINGS, RATING_LABEL, STRANDS } from '../../curriculum/levels'
import { REPORT_STATUSES } from '../rules'

/**
 * One player's report in a cycle. Coaches write it in the coach portal (autosaved), Management reviews and
 * releases it. Every step is logged in `history`.
 */
export const PlayerReports: CollectionConfig = {
  slug: 'player-reports',
  labels: { singular: 'Player report', plural: 'Player reports' },
  admin: { group: 'Reports', useAsTitle: 'playerName', defaultColumns: ['playerName', 'cycle', 'level', 'coach', 'status'], listSearchableFields: ['playerName'] },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: 'playerName',
  indexes: [{ fields: ['cycle', 'key'], unique: true }],
  fields: [
    { type: 'row', fields: [
      { name: 'cycle', type: 'relationship', relationTo: 'report-cycles', required: true, index: true },
      { name: 'status', type: 'select', required: true, defaultValue: 'not_started', index: true, options: [...REPORT_STATUSES] },
    ] },
    { name: 'key', type: 'text', required: true, admin: { hidden: true } },
    { type: 'row', fields: [
      { name: 'playerName', type: 'text', required: true },
      { name: 'birthYear', label: 'Year of birth', type: 'number' },
      { name: 'level', type: 'select', required: true, options: LEVELS.map((l) => ({ label: l.long, value: l.key })), admin: { description: 'Curriculum level reported against. Change it to report at another level.' } },
    ] },
    { name: 'coach', label: 'Written by', type: 'relationship', relationTo: 'users', index: true, filterOptions: { roles: { contains: 'coach' } } },
    { type: 'row', fields: [
      { name: 'source', type: 'select', options: [{ label: 'Academy term group', value: 'term' }, { label: 'Team', value: 'team' }] },
      { name: 'sourceLabel', label: 'Group / team', type: 'text' },
    ] },
    { type: 'row', fields: [
      { name: 'participant', label: 'Player', type: 'relationship', relationTo: 'participants', index: true },
      { name: 'account', label: 'Family account', type: 'relationship', relationTo: 'users', index: true },
      { name: 'registration', type: 'relationship', relationTo: 'academy-registrations' },
      { name: 'team', type: 'relationship', relationTo: 'teams' },
    ] },
    {
      name: 'strands',
      type: 'array',
      fields: [{ type: 'row', fields: [
        { name: 'strand', type: 'select', required: true, options: STRANDS.map((s) => ({ label: s.name, value: s.key })) },
        { name: 'rating', type: 'select', options: RATINGS.map((r) => ({ label: RATING_LABEL[r], value: r })) },
        { name: 'comment', type: 'textarea' },
      ] }],
    },
    { name: 'overall', label: 'Overall comment', type: 'textarea' },
    { name: 'returnNote', label: 'Note to coach (when returned)', type: 'textarea' },
    { type: 'row', fields: [
      { name: 'savedAt', label: 'Last saved', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'submittedAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'approvedAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'releasedAt', label: 'Released to family', type: 'date', index: true, admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'familyNotifiedAt', label: 'Family emailed/texted', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    ] },
    {
      name: 'history',
      type: 'array',
      admin: { readOnly: true, initCollapsed: true },
      fields: [{ type: 'row', fields: [
        { name: 'action', type: 'text' },
        { name: 'by', type: 'relationship', relationTo: 'users' },
        { name: 'at', type: 'date' },
        { name: 'note', type: 'text' },
      ] }],
    },
  ],
}
