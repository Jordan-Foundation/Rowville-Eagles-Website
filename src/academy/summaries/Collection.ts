import type { CollectionConfig, FieldAccess } from 'payload'
import { hasRole, isStaff, type WithRoles } from '../../access'

/** What the coach taps for "Worked on" — kept short so the summary takes two minutes. */
export const FOCUS = [
  'First touch', 'Ball mastery', 'Dribbling & 1v1', 'Passing', 'Receiving & turning', 'Shooting & finishing',
  'Weak foot', 'Defending 1v1', 'Heading', 'Speed & agility', 'Game understanding', 'Confidence',
] as const

const staffOnly: FieldAccess = ({ req: { user } }) => hasRole(user as WithRoles, 'admin', 'committee', 'coach')

/**
 * The coach's 2-minute summary after a 1-on-1 or small group session. Everything is shared with the family except
 * "Coach & admin notes". Small groups: one summary per group session, plus an optional line per player.
 * Coaches write them in the portal (Session summaries); families get an email and see them on the player's profile.
 */
export const SessionSummaries: CollectionConfig = {
  slug: 'session-summaries',
  labels: { singular: 'Session summary', plural: 'Session summaries' },
  admin: { group: 'Foundation Academy', useAsTitle: 'title', defaultColumns: ['title', 'coach', 'sessionAt', 'submittedAt', 'hidden'], description: 'Written by coaches after each session. Tick “Hide from family” to take one down.' },
  access: { read: isStaff, create: () => false, update: isStaff, delete: isStaff },
  defaultSort: '-sessionAt',
  fields: [
    { name: 'title', type: 'text', admin: { readOnly: true } },
    { name: 'session', label: 'Session (1-on-1, or the group’s time-held row)', type: 'relationship', relationTo: 'academy-sessions', required: true, unique: true, index: true, admin: { readOnly: true } },
    { name: 'kind', type: 'select', options: [{ label: '1-on-1', value: 'one-on-one' }, { label: 'Small group', value: 'group' }], admin: { readOnly: true } },
    { name: 'coach', type: 'relationship', relationTo: 'academy-coaches', required: true, index: true, admin: { readOnly: true } },
    { name: 'sessionAt', type: 'date', required: true, index: true, admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'workedOn', label: 'Worked on', type: 'select', hasMany: true, options: FOCUS.map((f) => ({ label: f, value: f })) },
    { name: 'wentWell', label: 'What went well', type: 'textarea', maxLength: 600 },
    { name: 'nextSteps', label: 'Next steps', type: 'textarea', maxLength: 600 },
    { name: 'homework', label: 'Practise at home', type: 'textarea', maxLength: 600 },
    { name: 'effort', label: 'Effort (1–5)', type: 'number', min: 1, max: 5 },
    {
      name: 'players',
      label: 'Per player (small groups)',
      type: 'array',
      fields: [
        { name: 'session', type: 'relationship', relationTo: 'academy-sessions', required: true },
        { name: 'name', type: 'text' },
        { name: 'note', type: 'textarea', maxLength: 400 },
      ],
    },
    { name: 'privateNotes', label: 'Coach & admin notes (never shown to the family)', type: 'textarea', maxLength: 1500, access: { read: staffOnly, update: staffOnly } },
    { type: 'row', fields: [
      { name: 'submittedAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'submittedBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
      { name: 'emailedAt', label: 'Family emailed', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    ] },
    { name: 'hidden', label: 'Hide from family', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
  ],
}
