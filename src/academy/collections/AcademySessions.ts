import type { CollectionConfig } from 'payload'
import { hasRole, isStaff } from '../../access'

/**
 * One row per actual session (a casual booking = 1 row, a term booking = 1 row per week). Small groups
 * have one `group-slot` row per date plus one `group-player` row per player.
 * The database has a unique index on (coach, startsAt) for every status except `cancelled`, ignoring
 * `group-player` rows, so a coach can never be double-booked — 1-on-1 or group — even if two families
 * pay at the same instant.
 */
export const AcademySessions: CollectionConfig = {
  slug: 'academy-sessions',
  labels: { singular: '1-on-1 session', plural: '1-on-1 sessions' },
  admin: {
    group: 'Foundation Academy',
    defaultColumns: ['startsAt', 'coach', 'booking', 'status', 'needsCover', 'coverCoach'],
    description: 'Filter by “Needs cover” to see sessions where the coach is away.',
  },
  access: {
    read: ({ req: { user } }) => (user ? (hasRole(user as never, 'admin', 'committee') ? true : { account: { equals: user.id } }) : false),
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  defaultSort: 'startsAt',
  fields: [
    {
      name: 'booking',
      type: 'relationship',
      relationTo: 'academy-bookings',
      index: true,
      // Every session belongs to a booking except a small group's own slot rows
      validate: (v: unknown, { siblingData }: { siblingData: Record<string, unknown> }) => Boolean(v) || siblingData?.kind === 'group-slot' || 'Choose the booking',
    },
    { type: 'row', fields: [
      {
        name: 'kind',
        type: 'select',
        required: true,
        defaultValue: 'one-on-one',
        index: true,
        options: [
          { label: '1-on-1', value: 'one-on-one' },
          { label: 'Small group — player', value: 'group-player' },
          { label: 'Small group — time held', value: 'group-slot' },
        ],
        admin: { description: 'A small group holds its time with one “time held” row per date; each player has their own row too.' },
      },
      { name: 'group', type: 'relationship', relationTo: 'academy-groups', index: true, admin: { condition: (d) => d?.kind !== 'one-on-one' } },
    ] },
    { type: 'row', fields: [
      { name: 'coach', type: 'relationship', relationTo: 'academy-coaches', required: true, index: true },
      { name: 'startsAt', type: 'date', required: true, index: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    ] },
    {
      name: 'status', index: true,
      type: 'select',
      required: true,
      defaultValue: 'held',
      options: [
        { label: 'Held (checkout in progress)', value: 'held' },
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Completed', value: 'completed' },
        { label: 'No-show', value: 'no_show' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    },
    { name: 'account', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
    {
      type: 'collapsible',
      label: 'Cover (coach away)',
      admin: { initCollapsed: false },
      fields: [
        { name: 'needsCover', type: 'checkbox', defaultValue: false, index: true, admin: { description: 'The booked coach is away for this session' } },
        { type: 'row', fields: [
          { name: 'coverCoach', type: 'relationship', relationTo: 'academy-coaches' },
          { name: 'coverNote', label: 'Handover notes', type: 'textarea' },
        ] },
      ],
    },
    { name: 'paid', type: 'checkbox', defaultValue: false },
    {
      type: 'collapsible',
      label: 'Cancellation / make-up',
      admin: { condition: (d) => d?.status === 'cancelled' || Boolean(d?.makeUpFor) },
      fields: [
        { type: 'row', fields: [
          { name: 'cancelledBy', type: 'select', options: ['family', 'coach', 'admin'], admin: { readOnly: true } },
          { name: 'cancelledAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
        ] },
        { name: 'cancelReason', type: 'textarea', admin: { readOnly: true } },
        { name: 'makeUpFor', label: 'Make-up for session', type: 'relationship', relationTo: 'academy-sessions', admin: { readOnly: true } },
      ],
    },
    {
      type: 'collapsible',
      label: 'Coach',
      fields: [
        { type: 'row', fields: [
          { name: 'attendanceBy', label: 'Attendance marked by', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
          { name: 'attendanceAt', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
        ] },
        {
          name: 'coachNotes',
          label: 'Coach’s private notes',
          type: 'textarea',
          // Families can read their own sessions through the API — this field is hidden from them.
          access: { read: ({ req: { user } }) => hasRole(user as never, 'admin', 'committee', 'coach') },
          admin: { description: 'Seen by coaches and admins only — never shown to the family.' },
        },
      ],
    },
    { name: 'reminderSentAt', type: 'date', admin: { readOnly: true } },
  ],
}
