import type { CollectionConfig } from 'payload'
import { isStaff } from '../../../access'
import { validMonth } from '../challenge-rules'

/** Premium monthly challenges: one skill test a month, best checked score wins, prizes per year of birth. */
export const PdrChallenges: CollectionConfig = {
  slug: 'pdr-challenges',
  labels: { singular: 'Monthly challenge', plural: 'Monthly challenges' },
  admin: {
    group: 'Foundation+',
    useAsTitle: 'title',
    defaultColumns: ['title', 'month', 'published', 'closedAt'],
    description: 'One challenge per month for Premium players. Set it up before the month starts; results and winner emails are sent automatically once the month ends and every attempt has been checked.',
  },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: '-month',
  fields: [
    { type: 'row', fields: [
      { name: 'title', type: 'text', required: true, admin: { placeholder: 'e.g. 60-second juggling' } },
      {
        name: 'month',
        type: 'text',
        required: true,
        unique: true,
        index: true,
        admin: { description: 'YYYY-MM, e.g. 2026-12. Runs for that whole calendar month.' },
        validate: (v: unknown) => (typeof v === 'string' && validMonth(v)) || 'Use YYYY-MM, e.g. 2026-12',
      },
      { name: 'published', label: 'Live (players can see it)', type: 'checkbox', defaultValue: false },
    ] },
    { name: 'description', label: 'The challenge', type: 'textarea', required: true, admin: { description: 'What to do, in one or two sentences.' } },
    { name: 'rules', label: 'How to film it', type: 'textarea', admin: { description: 'Set-up, camera angle, what counts. Shown above the upload form.' } },
    { name: 'demoVideo', label: 'Demo video', type: 'relationship', relationTo: 'pdr-videos' },
    { type: 'row', fields: [
      { name: 'unit', type: 'text', required: true, defaultValue: 'points', admin: { description: 'e.g. touches, seconds, goals' } },
      { name: 'direction', label: 'Best score is', type: 'select', required: true, defaultValue: 'higher', options: [{ label: 'Highest', value: 'higher' }, { label: 'Lowest (e.g. fastest time)', value: 'lower' }] },
    ] },
    { type: 'row', fields: [
      { name: 'groupBy', label: 'Winners', type: 'select', required: true, defaultValue: 'birthYear', options: [{ label: 'One per year of birth', value: 'birthYear' }, { label: 'Overall (everyone together)', value: 'all' }] },
      { name: 'winnersPerGroup', label: 'Winners per group', type: 'number', required: true, defaultValue: 1, min: 1, max: 10 },
    ] },
    { name: 'prize', type: 'textarea', admin: { description: 'Shown to players, e.g. “Foundation+ hoodie + a free 1-on-1 session”.' } },
    {
      type: 'collapsible',
      label: 'Results (filled in automatically)',
      admin: { initCollapsed: true },
      fields: [
        { type: 'row', fields: [
          { name: 'announcedAt', label: 'Start email sent', type: 'date', admin: { readOnly: true } },
          { name: 'closedAt', label: 'Results finalised', type: 'date', admin: { readOnly: true } },
        ] },
        {
          name: 'results',
          type: 'array',
          admin: { readOnly: true },
          fields: [
            { type: 'row', fields: [
              { name: 'player', type: 'relationship', relationTo: 'participants' },
              { name: 'group', type: 'text' },
              { name: 'rank', type: 'number' },
              { name: 'value', label: 'Score', type: 'number' },
              { name: 'winner', type: 'checkbox' },
            ] },
          ],
        },
        { name: 'prizesSent', label: 'Prizes sent to winners', type: 'checkbox', defaultValue: false, admin: { description: 'Tick once you’ve sent the prizes (for your records).' } },
      ],
    },
  ],
}
