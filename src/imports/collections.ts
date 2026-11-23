import type { CollectionConfig, Field } from 'payload'
import { isStaff } from '../access'

/** One run of the existing-player import: who, when, which file, what it created — so it can be reviewed or undone. */
export const ImportBatches: CollectionConfig = {
  slug: 'import-batches',
  labels: { singular: 'Player import', plural: 'Player imports' },
  admin: { group: 'People', defaultColumns: ['createdAt', 'fileName', 'status', 'by'], useAsTitle: 'fileName' },
  access: { read: isStaff, create: () => false, update: () => false, delete: () => false },
  defaultSort: '-createdAt',
  fields: [
    { name: 'fileName', type: 'text', required: true },
    { name: 'by', type: 'relationship', relationTo: 'users' },
    { name: 'status', type: 'select', defaultValue: 'imported', options: ['imported', 'undone'], index: true },
    { name: 'counts', type: 'json', admin: { description: 'familiesCreated, familiesMatched, playersCreated, playersUpdated, skipped' } },
    { name: 'log', type: 'json', admin: { description: 'What was created / changed, for Undo' } },
    { name: 'undoneAt', type: 'date' },
    { name: 'undoneBy', type: 'relationship', relationTo: 'users' },
  ],
}

/** Imported family accounts: where they came from, and the portal launch messages they've been sent. */
export const userImportFields: Field[] = [
  {
    name: 'familyAccount',
    label: 'Second parent of',
    type: 'relationship',
    relationTo: 'users',
    index: true,
    admin: { position: 'sidebar', readOnly: true, description: 'Parent 2 logins see this family’s players, bookings and payments' },
  },
  {
    name: 'imported',
    label: 'Imported family',
    type: 'group',
    admin: { condition: (d) => Boolean(d?.imported?.batch), description: 'Set by Management → Import players' },
    fields: [
      { type: 'row', fields: [
        { name: 'batch', type: 'relationship', relationTo: 'import-batches', index: true, admin: { readOnly: true } },
        { name: 'relationship', type: 'text' },
        { name: 'priorClient', label: 'Paid for 1-on-1s, camps or academy before (or RFA)', type: 'checkbox', defaultValue: false },
      ] },
      { type: 'row', fields: [
        { name: 'suburb', type: 'text' },
        { name: 'postcode', type: 'text' },
        { name: 'getsMessages', label: 'Gets launch messages', type: 'checkbox', defaultValue: true },
      ] },
    ],
  },
  {
    name: 'launch',
    label: 'Portal launch messages',
    type: 'group',
    admin: { condition: (d) => Boolean(d?.imported?.batch), readOnly: true },
    fields: [
      { type: 'row', fields: [
        { name: 'emailAt', label: 'Launch email sent', type: 'date', index: true },
        { name: 'emailStatus', type: 'select', options: ['sent', 'delivered', 'bounced', 'failed'] },
        { name: 'smsAt', label: 'Launch text sent', type: 'date' },
        { name: 'smsStatus', type: 'select', options: ['sent', 'delivered', 'failed', 'skipped'] },
        { name: 'smsSid', type: 'text', index: true, admin: { hidden: true } },
        { name: 'smsTries', type: 'number', admin: { hidden: true } },
      ] },
      { type: 'row', fields: [
        { name: 'reminderAt', label: 'Reminder sent', type: 'date' },
        { name: 'followUpAt', label: '1-on-1 follow-up sent', type: 'date' },
        { name: 'followUpStatus', type: 'select', options: ['sent', 'delivered', 'bounced', 'failed'] },
        { name: 'unsubscribedAt', type: 'date' },
      ] },
      { name: 'emailSubject', type: 'text', admin: { hidden: true } },
      { name: 'followUpSubject', type: 'text', admin: { hidden: true } },
      { name: 'shortCode', type: 'text', unique: true, index: true, admin: { hidden: true } },
      { name: 'shortCodeExpires', type: 'date', admin: { hidden: true } },
    ],
  },
]

/** Imported player extras (Management only). */
export const participantImportFields: Field[] = [
  {
    name: 'imported',
    label: 'Imported player',
    type: 'group',
    admin: { condition: (d) => Boolean(d?.imported?.batch) },
    access: { read: ({ req: { user } }) => Boolean(user && ((user as { roles?: string[] }).roles ?? []).some((r) => r === 'admin' || r === 'committee')) },
    fields: [
      { type: 'row', fields: [
        { name: 'batch', type: 'relationship', relationTo: 'import-batches', index: true, admin: { readOnly: true } },
        { name: 'registrationStatus', type: 'select', options: [{ label: 'Paid (offline)', value: 'paid' }, { label: 'Not paid — owing', value: 'not_paid' }, { label: 'N/A', value: 'na' }], index: true },
        { name: 'registrationSource', type: 'text', admin: { readOnly: true, description: 'imported_paid_offline when paid before the portal' } },
      ] },
      { type: 'row', fields: [
        { name: 'mobile', label: 'Player mobile', type: 'text' },
        { name: 'email', label: 'Player email', type: 'text' },
        { name: 'owingEmailAt', label: 'Registration payment email sent', type: 'date', admin: { readOnly: true } },
      ] },
      { name: 'notes', label: 'Notes (Management only)', type: 'textarea' },
    ],
  },
]
