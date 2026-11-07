import type { CollectionConfig, FieldAccess } from 'payload'
import { anyone, isStaff } from '../access'

export const teamCategories = [
  { label: 'MiniRoos', value: 'miniroos' },
  { label: 'Junior Boys', value: 'junior-boys' },
  { label: 'Junior Girls', value: 'junior-girls' },
  { label: 'Senior Women', value: 'senior-women' },
  { label: 'Senior Men', value: 'senior-men' },
] as const

/** Contacts, schedules and fixtures on team pages are for signed-in members only (the team list itself is public). */
const signedIn: FieldAccess = ({ req: { user } }) => Boolean(user)

const isTournament = (d: Record<string, unknown> | undefined) => d?.type === 'tournament'

/**
 * A club team or a tournament team. Every team has a members-only Team Page (/teams/<slug>) whose
 * sections are switched on/off per team. Members are added automatically when registration is paid.
 */
export const Teams: CollectionConfig = {
  slug: 'teams',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'type', 'category', 'ageGroup', 'archived'], group: 'Club' },
  access: { read: anyone, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: 'order',
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { type: 'row', fields: [
      { name: 'type', type: 'select', required: true, defaultValue: 'rowville', options: [{ label: 'Rowville club team', value: 'rowville' }, { label: 'Tournament team', value: 'tournament' }] },
      { name: 'season', type: 'number' },
      { name: 'archived', type: 'checkbox', defaultValue: false, admin: { description: 'Hides the team page from families after the season / tournament' } },
    ] },
    { name: 'brand', type: 'select', defaultValue: 'club', options: ['club', 'academy'], admin: { position: 'sidebar', description: 'Look and sender of team emails' } },
    { name: 'event', label: 'Tournament name', type: 'text', admin: { condition: isTournament, description: 'Shown as “[Tournament] – [Team]”' } },
    { name: 'category', type: 'select', options: [...teamCategories], admin: { condition: (d) => !isTournament(d) } },
    { name: 'ageGroup', type: 'text', admin: { description: 'e.g. 2017s' } },
    { name: 'competition', type: 'text', admin: { description: 'League / division' } },
    { name: 'coaches', type: 'relationship', relationTo: 'users', hasMany: true, admin: { description: 'Coaches/managers can post notices, edit training and fixtures, and moderate the forum' } },
    {
      name: 'sections',
      label: 'Team page sections',
      type: 'group',
      fields: [
        { type: 'row', fields: [
          { name: 'info', label: 'Tournament info', type: 'checkbox', defaultValue: true },
          { name: 'notices', label: 'Notice board', type: 'checkbox', defaultValue: true },
          { name: 'fixtures', label: 'Fixtures & results', type: 'checkbox', defaultValue: true },
          { name: 'training', label: 'Training schedule', type: 'checkbox', defaultValue: true },
          { name: 'forum', label: 'Parent forum', type: 'checkbox', defaultValue: true },
        ] },
      ],
    },
    {
      name: 'info',
      label: 'Tournament info',
      type: 'group',
      access: { read: signedIn },
      admin: { condition: isTournament },
      fields: [
        { name: 'dates', type: 'text', admin: { description: 'e.g. Sat 20 – Sun 21 March 2027' } },
        { name: 'venues', type: 'textarea' },
        { name: 'schedule', type: 'textarea', admin: { description: 'Arrival times, game times, presentations…' } },
        { name: 'whatToBring', type: 'textarea' },
        { name: 'costs', type: 'textarea' },
        { name: 'contacts', type: 'textarea', admin: { description: 'Team manager / coach names and phone numbers' } },
      ],
    },
    { name: 'externalUrl', label: 'Tournament website (external)', type: 'text', admin: { condition: isTournament } },
    { name: 'driblUrl', label: 'Fixtures link (Dribl / competition site)', type: 'text', admin: { description: 'Families see “Fixtures not yet released” until this or fixtures below are added' } },
    {
      name: 'fixtures',
      type: 'array',
      access: { read: signedIn },
      admin: { description: 'Upcoming fixtures and results (coaches can also edit these on the team page)' },
      fields: [
        { type: 'row', fields: [
          { name: 'startsAt', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
          { name: 'opponent', type: 'text', required: true },
          { name: 'venue', type: 'text' },
          { name: 'result', type: 'text', admin: { description: 'e.g. W 3–1' } },
        ] },
      ],
    },
    {
      name: 'training',
      type: 'array',
      access: { read: signedIn },
      fields: [
        { type: 'row', fields: [
          { name: 'day', type: 'select', required: true, options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
          { name: 'start', type: 'text', required: true, admin: { description: '24h, e.g. 17:00' } },
          { name: 'end', type: 'text', admin: { description: '24h, e.g. 18:00' } },
          { name: 'location', type: 'text' },
        ] },
      ],
    },
    { name: 'trainingChangedAt', type: 'date', admin: { readOnly: true, description: 'Changes are highlighted on the team page for 14 days' } },
    { name: 'trainingTimes', label: 'Training (public summary)', type: 'text', admin: { description: 'Short text for the public Fixtures page, e.g. “Tue & Thu 5:00pm”' } },
    { name: 'driblTeamId', type: 'text', admin: { description: 'Dribl team identifier (future automatic fixtures)' } },
    { name: 'photo', type: 'upload', relationTo: 'media' },
    { name: 'order', type: 'number', defaultValue: 0 },
  ],
}
