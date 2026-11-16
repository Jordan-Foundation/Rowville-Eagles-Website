import type { CollectionConfig, GlobalConfig } from 'payload'
import { isStaff } from '../access'
import { DEFAULT_WELFARE_KEYWORDS } from './rules'

const readOnly = { readOnly: true } as const

/** The skill areas players tag each moment with (seeded with the six PDR areas). */
export const ReflectionPillars: CollectionConfig = {
  slug: 'reflection-pillars',
  labels: { singular: 'Reflection pillar', plural: 'Reflection pillars' },
  admin: { group: 'Reflections', useAsTitle: 'name', defaultColumns: ['name', 'active', 'sortOrder'], description: 'Skill areas players choose from. Edit in Management → Reflections → Settings.' },
  access: { read: () => true, create: isStaff, update: isStaff, delete: () => false },
  defaultSort: 'sortOrder',
  fields: [
    { type: 'row', fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'active', type: 'checkbox', defaultValue: true },
      { name: 'sortOrder', type: 'number', defaultValue: 0 },
    ] },
    { name: 'hint', type: 'text', admin: { description: 'Short example shown to players, e.g. “first touch, receiving on the half-turn”' } },
  ],
}

/** One per player per game. Players/parents see their own, coaches their teams, Management all (checked in code). */
export const MatchReflections: CollectionConfig = {
  slug: 'match-reflections',
  labels: { singular: 'Match reflection', plural: 'Match reflections' },
  admin: { group: 'Reflections', defaultColumns: ['participant', 'team', 'opponent', 'fixtureAt', 'status'], description: 'Use Management → Reflections.' },
  access: { read: isStaff, create: () => false, update: () => false, delete: isStaff },
  defaultSort: '-fixtureAt',
  indexes: [{ fields: ['participant', 'fixtureId'], unique: true }],
  fields: [
    { type: 'row', fields: [
      { name: 'participant', label: 'Player', type: 'relationship', relationTo: 'participants', required: true, index: true },
      { name: 'account', label: 'Family', type: 'relationship', relationTo: 'users', required: true, index: true },
      { name: 'team', type: 'relationship', relationTo: 'teams', required: true, index: true },
    ] },
    { type: 'row', fields: [
      { name: 'fixtureId', type: 'text', required: true, index: true },
      { name: 'fixtureAt', label: 'Kick-off', type: 'date', required: true, index: true },
      { name: 'opponent', type: 'text' },
      { name: 'ageGroup', type: 'text', index: true },
    ] },
    { type: 'row', fields: [
      { name: 'feeling', type: 'number', min: 1, max: 5 },
      { name: 'status', type: 'select', required: true, defaultValue: 'draft', index: true, options: [{ label: 'Draft', value: 'draft' }, { label: 'Submitted', value: 'submitted' }] },
      { name: 'submittedAt', type: 'date', index: true },
      { name: 'source', type: 'select', options: [{ label: 'Family account', value: 'family' }, { label: 'Player link', value: 'link' }] },
    ] },
    {
      name: 'moments',
      type: 'array',
      fields: [
        { type: 'row', fields: [
          { name: 'type', type: 'select', required: true, options: [{ label: 'Did well', value: 'great' }, { label: 'To work on', value: 'improve' }] },
          { name: 'position', type: 'number' },
          { name: 'pillar', type: 'relationship', relationTo: 'reflection-pillars' },
          { name: 'pillarName', type: 'text' },
        ] },
        { name: 'comment', type: 'textarea' },
      ],
    },
    { name: 'focus', label: 'Focus for next game', type: 'text' },
    {
      name: 'feedback',
      label: 'Coach feedback',
      type: 'array',
      fields: [{ type: 'row', fields: [
        { name: 'coach', type: 'relationship', relationTo: 'users' },
        { name: 'seenAt', type: 'date' },
      ] }, { name: 'comment', type: 'textarea' }],
    },
    { name: 'welfareCheckedAt', type: 'date', index: true, admin: { ...readOnly, description: 'When the safeguarding check last ran on the submitted text' } },
    { name: 'welfareCheckedHash', type: 'text', admin: { hidden: true } },
  ],
}

/** A reflection that might show a child is unsafe or unwell — goes to the safeguarding contact, never only into a report. */
export const WelfareFlags: CollectionConfig = {
  slug: 'welfare-flags',
  labels: { singular: 'Welfare flag', plural: 'Welfare flags' },
  admin: { group: 'Reflections', defaultColumns: ['participant', 'reason', 'source', 'status', 'createdAt'], description: 'Use Management → Reflections → Welfare.' },
  access: { read: isStaff, create: () => false, update: isStaff, delete: () => false },
  defaultSort: '-createdAt',
  fields: [
    { type: 'row', fields: [
      { name: 'reflection', type: 'relationship', relationTo: 'match-reflections', required: true, index: true },
      { name: 'participant', label: 'Player', type: 'relationship', relationTo: 'participants', index: true },
      { name: 'team', type: 'relationship', relationTo: 'teams' },
    ] },
    { name: 'excerpt', type: 'textarea', admin: readOnly },
    { type: 'row', fields: [
      { name: 'reason', type: 'text', admin: readOnly },
      { name: 'source', type: 'select', required: true, options: [{ label: 'Keyword', value: 'keyword' }, { label: 'AI check', value: 'ai' }], admin: readOnly },
      { name: 'severity', type: 'select', options: ['low', 'medium', 'high'], admin: readOnly },
    ] },
    { type: 'row', fields: [
      { name: 'status', type: 'select', required: true, defaultValue: 'open', index: true, options: [{ label: 'Open', value: 'open' }, { label: 'Reviewed', value: 'reviewed' }] },
      { name: 'reviewedBy', type: 'relationship', relationTo: 'users' },
      { name: 'reviewedAt', type: 'date' },
    ] },
    { name: 'notes', label: 'What was done', type: 'textarea' },
    { name: 'notifiedAt', type: 'date', admin: readOnly },
  ],
}

/** The weekend report per team / age group / club: numbers from code, wording from the AI. */
export const ReflectionReports: CollectionConfig = {
  slug: 'reflection-reports',
  labels: { singular: 'Reflection report', plural: 'Reflection reports' },
  admin: { group: 'Reflections', useAsTitle: 'scopeLabel', defaultColumns: ['scopeLabel', 'periodFrom', 'status', 'generatedAt'], description: 'Use Management → Reflections → Reports.' },
  access: { read: isStaff, create: () => false, update: () => false, delete: isStaff },
  defaultSort: '-periodFrom',
  indexes: [{ fields: ['scopeType', 'scopeKey', 'periodFrom'], unique: true }],
  fields: [
    { type: 'row', fields: [
      { name: 'scopeType', type: 'select', required: true, index: true, options: [{ label: 'Team', value: 'team' }, { label: 'Age group', value: 'age_group' }, { label: 'Club', value: 'club' }] },
      { name: 'scopeKey', type: 'text', required: true, index: true },
      { name: 'scopeLabel', type: 'text' },
    ] },
    { type: 'row', fields: [
      { name: 'periodFrom', type: 'text', required: true, index: true, admin: { description: 'YYYY-MM-DD (inclusive)' } },
      { name: 'periodTo', type: 'text', required: true, admin: { description: 'YYYY-MM-DD (exclusive)' } },
    ] },
    { name: 'stats', type: 'json' },
    { name: 'summary', type: 'json' },
    { type: 'row', fields: [
      { name: 'status', type: 'select', required: true, options: [{ label: 'Ready', value: 'ok' }, { label: 'Numbers only (AI failed)', value: 'failed' }, { label: 'Numbers only (AI off)', value: 'stats_only' }, { label: 'Not enough reflections', value: 'empty' }] },
      { name: 'model', type: 'text' },
      { name: 'promptVersion', type: 'text' },
      { name: 'generatedAt', type: 'date' },
    ] },
    { name: 'error', type: 'text' },
    { name: 'notifiedAt', type: 'date' },
  ],
}

/** Reminder emails already sent (one per player, game and kind). */
export const ReflectionReminders: CollectionConfig = {
  slug: 'reflection-reminders',
  labels: { singular: 'Reflection reminder', plural: 'Reflection reminders' },
  admin: { group: 'Reflections', hidden: true },
  access: { read: isStaff, create: () => false, update: () => false, delete: () => false },
  indexes: [{ fields: ['participant', 'fixtureId', 'kind'], unique: true }],
  fields: [
    { name: 'participant', type: 'relationship', relationTo: 'participants', required: true, index: true },
    { name: 'fixtureId', type: 'text', required: true, index: true },
    { name: 'kind', type: 'select', required: true, options: ['open', 'closing'] },
  ],
}

export const ReflectionSettings: GlobalConfig = {
  slug: 'reflection-settings',
  label: 'Reflection settings',
  admin: { group: 'Reflections' },
  access: { read: isStaff, update: isStaff },
  fields: [
    { name: 'enabled', label: 'Match Reflections are on', type: 'checkbox', defaultValue: true },
    { type: 'row', fields: [
      { name: 'opensAfterHours', label: 'Opens (hours after kick-off)', type: 'number', defaultValue: 3, min: 0, max: 48 },
      { name: 'closesAfterDays', label: 'Closes (days after kick-off, or at the next game if sooner)', type: 'number', defaultValue: 4, min: 1, max: 14 },
    ] },
    { type: 'row', fields: [
      { name: 'remindOnOpen', label: 'Email families when it opens', type: 'checkbox', defaultValue: true },
      { name: 'closingReminderHours', label: 'Reminder this many hours before it closes (0 = off)', type: 'number', defaultValue: 24, min: 0, max: 96 },
    ] },
    { name: 'teams', label: 'Only these teams (leave empty for every Rowville club team)', type: 'relationship', relationTo: 'teams', hasMany: true },
    { name: 'showStreak', label: 'Show reflection streaks to players', type: 'checkbox', defaultValue: true },
    { type: 'row', fields: [
      { name: 'aiReports', label: 'Weekend AI report is on (sent once the last reflection for the week’s games closes)', type: 'checkbox', defaultValue: true },
      { name: 'reportDay', label: 'Report day (no longer used)', type: 'select', defaultValue: '1', admin: { hidden: true }, options: [{ label: 'Sunday', value: '0' }, { label: 'Monday', value: '1' }, { label: 'Tuesday', value: '2' }, { label: 'Wednesday', value: '3' }, { label: 'Thursday', value: '4' }, { label: 'Friday', value: '5' }, { label: 'Saturday', value: '6' }] },
      { name: 'reportHour', label: 'Report hour (no longer used)', type: 'number', defaultValue: 9, min: 0, max: 23, admin: { hidden: true } },
    ] },
    { name: 'aiWelfareCheck', label: 'AI safeguarding check on every reflection (as well as keywords)', type: 'checkbox', defaultValue: true },
    { name: 'safeguardingEmail', label: 'Safeguarding contact email', type: 'email', admin: { description: 'Gets every welfare flag straight away. Falls back to the club’s contact email.' } },
    { name: 'keywords', label: 'Welfare keywords (one per line)', type: 'textarea', defaultValue: DEFAULT_WELFARE_KEYWORDS.join('\n') },
  ],
}
