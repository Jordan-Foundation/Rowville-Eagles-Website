import type { CollectionConfig, Field, GlobalConfig } from 'payload'
import { refreshAfterChange, refreshAfterDelete, refreshGlobal } from '../lib/revalidate'
import { anyone, isStaff } from '../access'

/** The three senior teams, in menu order (the page lives at /seniors/<slug>). */
export const SENIOR_TEAMS = [
  { key: 'men', slug: 'senior-men', name: 'Senior Men' },
  { key: 'reserves', slug: 'reserves', name: 'Reserves' },
  { key: 'women', slug: 'senior-women', name: 'Senior Women' },
] as const
export type SeniorKey = (typeof SENIOR_TEAMS)[number]['key']

const teamFields = (name: string): Field[] => [
  { name: 'tagline', type: 'text', admin: { description: `Short line under “${name}”` } },
  { name: 'about', label: 'About the team', type: 'textarea' },
  { name: 'photo', label: 'Team photo', type: 'upload', relationTo: 'media' },
  { type: 'row', fields: [
    { name: 'coachName', label: 'Coach name', type: 'text' },
    { name: 'coachRole', label: 'Coach title', type: 'text', admin: { placeholder: 'Head coach' } },
  ] },
  { name: 'coachPhoto', label: 'Coach photo', type: 'upload', relationTo: 'media' },
  { name: 'coachBio', label: 'Coach bio', type: 'textarea' },
  { type: 'row', fields: [
    { name: 'league', type: 'text', admin: { placeholder: 'e.g. Victorian State League 4 South-East' } },
    { name: 'leagueUrl', label: 'League link (fixtures & table)', type: 'text' },
  ] },
  { name: 'training', label: 'Training details', type: 'textarea', admin: { description: 'Nights, times and where — one per line' } },
  { name: 'matchDay', label: 'Match day', type: 'text', admin: { placeholder: 'e.g. Saturdays, home games at Park Ridge Reserve' } },
]

/** Senior team pages (Senior Men, Reserves, Senior Women) and where senior enquiries go. */
export const SeniorTeamsPage: GlobalConfig = {
  slug: 'senior-teams',
  label: 'Senior team pages',
  admin: { group: 'Club', description: 'The Senior Men, Reserves and Senior Women pages. Empty fields are simply left off the page.' },
  access: { read: () => true, update: isStaff },
  hooks: { afterChange: [refreshGlobal] },
  fields: [
    { name: 'enquiryEmail', label: 'Senior enquiries go to', type: 'email', required: true, defaultValue: 'refc.secretary@outlook.com' },
    ...SENIOR_TEAMS.map((t): Field => ({ name: t.key, label: t.name, type: 'group', fields: teamFields(t.name) })),
  ],
}

/** Senior player enquiries (also emailed to the secretary). */
export const Enquiries: CollectionConfig = {
  slug: 'enquiries',
  labels: { singular: 'Senior enquiry', plural: 'Senior enquiries' },
  admin: { group: 'Club', useAsTitle: 'name', defaultColumns: ['name', 'team', 'email', 'phone', 'status', 'createdAt'] },
  access: { read: isStaff, create: () => false, update: isStaff, delete: isStaff },
  defaultSort: '-createdAt',
  fields: [
    { type: 'row', fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'email', type: 'email', required: true },
      { name: 'phone', label: 'Mobile', type: 'text' },
    ] },
    { name: 'team', type: 'select', options: [...SENIOR_TEAMS.map((t) => ({ label: t.name, value: t.key })), { label: 'Not sure yet', value: 'unsure' }] },
    { type: 'row', fields: [
      { name: 'age', type: 'number' },
      { name: 'position', type: 'text' },
      { name: 'previousClub', label: 'Previous club / level', type: 'text' },
    ] },
    { name: 'message', type: 'textarea' },
    { name: 'status', type: 'select', defaultValue: 'new', index: true, options: [{ label: 'New', value: 'new' }, { label: 'Contacted', value: 'contacted' }, { label: 'Signed', value: 'signed' }, { label: 'Closed', value: 'closed' }] },
    { name: 'emailedTo', label: 'Emailed to', type: 'text', admin: { readOnly: true } },
  ],
}

/** Club events for the public calendar (/events) and its calendar feed. */
export const Events: CollectionConfig = {
  slug: 'events',
  admin: { group: 'Club', useAsTitle: 'title', defaultColumns: ['title', 'start', 'category', 'published'], description: 'Shown on the Events calendar. Holiday camps are added automatically from Programs.' },
  access: { read: anyone, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: 'start',
  hooks: { afterChange: [refreshAfterChange], afterDelete: [refreshAfterDelete] },
  fields: [
    { name: 'title', type: 'text', required: true },
    { type: 'row', fields: [
      { name: 'start', type: 'date', required: true, index: true, admin: { date: { pickerAppearance: 'dayAndTime', timeFormat: 'h:mm a' } } },
      { name: 'end', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime', timeFormat: 'h:mm a' }, description: 'Optional' } },
    ] },
    { name: 'allDay', label: 'All day', type: 'checkbox', defaultValue: false },
    { type: 'row', fields: [
      { name: 'category', type: 'select', defaultValue: 'club', options: [
        { label: 'Club', value: 'club' }, { label: 'Juniors', value: 'juniors' }, { label: 'Seniors', value: 'seniors' }, { label: 'Academy', value: 'academy' }, { label: 'Social & fundraising', value: 'social' },
      ] },
      { name: 'location', type: 'text', admin: { placeholder: 'Park Ridge Reserve, Rowville' } },
    ] },
    { name: 'summary', type: 'text', admin: { description: 'One line for the calendar' } },
    { name: 'details', type: 'textarea', admin: { description: 'Shown when someone taps the event' } },
    { type: 'row', fields: [
      { name: 'link', label: 'Button link (optional)', type: 'text' },
      { name: 'linkLabel', label: 'Button text', type: 'text', admin: { placeholder: 'Find out more' } },
    ] },
    { name: 'published', type: 'checkbox', defaultValue: true, index: true },
  ],
}

/** Committee list on the About global. */
export const committeeField: Field = {
  name: 'committee',
  label: 'Committee',
  type: 'array',
  admin: { description: 'Shown on About → Committee, in this order' },
  fields: [
    { type: 'row', fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'role', type: 'text', required: true, admin: { placeholder: 'President' } },
    ] },
    { name: 'photo', type: 'upload', relationTo: 'media' },
    { name: 'bio', type: 'textarea' },
    { name: 'email', label: 'Public email (optional)', type: 'email' },
  ],
}
