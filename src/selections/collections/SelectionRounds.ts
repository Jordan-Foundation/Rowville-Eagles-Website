import type { CollectionConfig } from 'payload'
import { isStaff } from '../../access'
import { DEFAULT_TEMPLATES } from '../templates'

const template = (kind: keyof typeof DEFAULT_TEMPLATES, label: string, condition?: (d: Record<string, unknown>) => boolean) => ({
  type: 'collapsible' as const,
  label,
  admin: { initCollapsed: true, ...(condition ? { condition } : {}) },
  fields: [
    { name: `${kind}Subject`, label: 'Email subject', type: 'text' as const, defaultValue: DEFAULT_TEMPLATES[kind].subject },
    { name: `${kind}Body`, label: 'Email message', type: 'textarea' as const, defaultValue: DEFAULT_TEMPLATES[kind].body, admin: { rows: 6 } },
    { name: `${kind}Sms`, label: 'Text message (SMS)', type: 'textarea' as const, defaultValue: DEFAULT_TEMPLATES[kind].sms, admin: { rows: 2, description: 'Leave blank to send no text' } },
  ],
})

/**
 * A selection round: one per tournament, or one per Rowville season intake (trials).
 * Families register interest (selection entries) into a round; staff then select or mark outcomes.
 */
export const SelectionRounds: CollectionConfig = {
  slug: 'selection-rounds',
  labels: { singular: 'Selection round', plural: 'Selection rounds' },
  admin: { group: 'Selections', useAsTitle: 'title', defaultColumns: ['title', 'kind', 'season', 'status', 'program'] },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: '-createdAt',
  fields: [
    { name: 'title', type: 'text', required: true },
    { type: 'row', fields: [
      { name: 'kind', type: 'select', required: true, options: [{ label: 'Tournament', value: 'tournament' }, { label: 'Rowville trials', value: 'rowville' }] },
      { name: 'season', type: 'number', required: true },
      { name: 'status', type: 'select', required: true, defaultValue: 'open', options: [{ label: 'Taking interest', value: 'open' }, { label: 'Selecting', value: 'selecting' }, { label: 'Closed', value: 'closed' }] },
    ] },
    {
      name: 'program',
      type: 'relationship',
      relationTo: 'programs',
      admin: { description: 'Tournament: the tournament. Rowville: the season registration players pay once successful.' },
    },
    {
      type: 'collapsible',
      label: 'Payment after selection',
      fields: [
        { type: 'row', fields: [
          { name: 'fee', label: 'Fee per player (AUD)', type: 'number', min: 0, admin: { description: 'Tournament fee. Rowville uses the registration program’s price.' } },
          { name: 'paymentDeadlineDays', label: 'Days to pay', type: 'number', defaultValue: 7, min: 1, max: 60 },
        ] },
        { name: 'reminderDays', label: 'Send reminders this many days before the deadline', type: 'number', hasMany: true, defaultValue: [3, 1] },
      ],
    },
    {
      name: 'templates',
      label: 'Outcome messages',
      type: 'group',
      admin: { description: 'Placeholders: {parent} {player} {playerFull} {team} {ageGroup} {event} {link} {deadline}. Staff review every message before it is sent.' },
      fields: [
        template('selected', 'Selected (tournament)', (d) => d?.kind !== 'rowville'),
        template('successful', 'Successful (Rowville trials)', (d) => d?.kind !== 'tournament'),
        template('unsuccessful', 'Unsuccessful'),
      ],
    },
  ],
}
