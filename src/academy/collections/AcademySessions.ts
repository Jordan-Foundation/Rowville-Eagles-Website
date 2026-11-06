import type { CollectionConfig } from 'payload'
import { hasRole, isStaff } from '../../access'

/**
 * One row per actual 1-on-1 session (a casual booking = 1 row, a term booking = 1 row per week).
 * The database has a unique index on (coach, startsAt) for every status except `cancelled`, so a coach
 * can never be double-booked — even if two families pay at the same instant.
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
    { name: 'booking', type: 'relationship', relationTo: 'academy-bookings', required: true, index: true },
    { type: 'row', fields: [
      { name: 'coach', type: 'relationship', relationTo: 'academy-coaches', required: true, index: true },
      { name: 'startsAt', type: 'date', required: true, index: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    ] },
    {
      name: 'status',
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
    { name: 'reminderSentAt', type: 'date', admin: { readOnly: true } },
  ],
}
