import type { CollectionConfig } from 'payload'
import { isStaff } from '../../access'
import { PROGRAM_GROUPS } from '../rules'

/**
 * A discount for chosen families on anything that costs money on the website. Families who receive it get the
 * discount automatically at checkout while it's live (calculated on the server; each use is recorded).
 * Easiest from Management → Promotions.
 */
export const Promotions: CollectionConfig = {
  slug: 'promotions',
  labels: { singular: 'Promotion', plural: 'Promotions' },
  admin: { group: 'Promotions', useAsTitle: 'name', defaultColumns: ['name', 'status', 'type', 'value', 'endsAt'] },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: '-createdAt',
  fields: [
    { type: 'row', fields: [
      { name: 'name', type: 'text', required: true, admin: { description: 'Shown to families, e.g. “Winter special”' } },
      { name: 'status', type: 'select', required: true, defaultValue: 'draft', index: true, options: [{ label: 'Draft', value: 'draft' }, { label: 'Live', value: 'live' }, { label: 'Ended', value: 'ended' }] },
    ] },
    { type: 'row', fields: [
      { name: 'type', label: 'Discount', type: 'select', required: true, defaultValue: 'percent', options: [{ label: '% off', value: 'percent' }, { label: '$ off', value: 'amount' }] },
      { name: 'value', type: 'number', required: true, min: 0.01, admin: { description: 'e.g. 20 (%) or 15 ($) — per booking / order' } },
      { name: 'usesPerFamily', label: 'Uses per family', type: 'number', min: 1, admin: { description: 'Leave empty for no limit' } },
    ] },
    { type: 'row', fields: [
      { name: 'startsAt', label: 'Starts', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'endsAt', label: 'Ends', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    ] },
    {
      type: 'collapsible',
      label: 'What it applies to',
      fields: [
        { name: 'everything', label: 'Everything on the website', type: 'checkbox' },
        { name: 'programGroups', label: 'Whole groups of programs', type: 'select', hasMany: true, options: PROGRAM_GROUPS.map((g) => ({ label: g.label, value: g.value })) },
        { name: 'programs', label: 'Single programs, camps, terms', type: 'relationship', relationTo: 'programs', hasMany: true },
        { type: 'row', fields: [
          { name: 'oneOnOneAll', label: 'All 1-on-1s', type: 'checkbox' },
          { name: 'oneOnOneTerms', label: '1-on-1s in these terms', type: 'relationship', relationTo: 'academy-terms', hasMany: true },
        ] },
        { type: 'row', fields: [
          { name: 'shopAll', label: 'Everything in the shop', type: 'checkbox' },
          { name: 'products', label: 'Shop items', type: 'relationship', relationTo: 'products', hasMany: true },
        ] },
        { type: 'row', fields: [
          { name: 'tournamentsAll', label: 'All tournament fees', type: 'checkbox' },
          { name: 'tournamentRounds', label: 'Tournament fees for', type: 'relationship', relationTo: 'selection-rounds', hasMany: true },
        ] },
        { name: 'foundationPlus', label: 'Foundation+ plans (first payment; not during a free trial)', type: 'checkbox' },
      ],
    },
    { name: 'recipients', label: 'Families who get it', type: 'relationship', relationTo: 'users', hasMany: true, admin: { description: 'Only these accounts get the discount (set when the promotion is sent).' } },
    {
      type: 'collapsible',
      label: 'Message',
      admin: { initCollapsed: true },
      fields: [
        { name: 'channels', type: 'select', hasMany: true, defaultValue: ['email'], options: [{ label: 'Email', value: 'email' }, { label: 'Text message', value: 'sms' }] },
        { name: 'subject', type: 'text' },
        { name: 'message', type: 'textarea' },
        { name: 'smsText', label: 'Text message', type: 'textarea' },
        { name: 'audience', type: 'json', admin: { readOnly: true } },
        { name: 'scheduledFor', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'sentAt', type: 'date', admin: { readOnly: true } },
        { name: 'sentCounts', type: 'json', admin: { readOnly: true } },
        { name: 'approvedBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
      ],
    },
  ],
}
