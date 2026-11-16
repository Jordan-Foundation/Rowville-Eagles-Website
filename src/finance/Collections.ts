import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, CollectionConfig, GlobalConfig } from 'payload'
import { isAdmin } from '../access'

/**
 * Finance data. Admins only — committee members and coaches can't read any of it, through the site or the API.
 * Every change to rates, hours, expenses and matches is written to the finance audit log.
 */
const admin = { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin }
const readOnly = { readOnly: true } as const
const group = 'Finance'

const audit = (area: string): { afterChange: CollectionAfterChangeHook[]; afterDelete: CollectionAfterDeleteHook[] } => ({
  afterChange: [async ({ doc, previousDoc, operation, req, collection }) => {
    try {
      await req.payload.create({ collection: 'finance-audit-log', data: { area, action: operation, collection: collection.slug, docId: doc.id, by: req.user?.id ?? null, before: operation === 'update' ? previousDoc : null, after: doc }, overrideAccess: true, req })
    } catch (e) { req.payload.logger.warn({ err: e, msg: 'Finance audit log failed' }) }
    return doc
  }],
  afterDelete: [async ({ doc, req, collection }) => {
    try {
      await req.payload.create({ collection: 'finance-audit-log', data: { area, action: 'delete', collection: collection.slug, docId: doc.id, by: req.user?.id ?? null, before: doc }, overrideAccess: true, req })
    } catch {}
    return doc
  }],
})

/** Hourly rates, effective-dated: a new rate starts on its date; past weeks keep the rate that applied then. */
export const CoachPayRates: CollectionConfig = {
  slug: 'coach-pay-rates',
  labels: { singular: 'Coach pay rate', plural: 'Coach pay rates' },
  admin: { group, defaultColumns: ['coach', 'hourlyRate', 'effectiveFrom'], description: 'Use Management → Finance → Coach hours & pay.' },
  access: admin,
  defaultSort: '-effectiveFrom',
  hooks: audit('Pay rates'),
  indexes: [{ fields: ['coach', 'effectiveFrom'], unique: true }],
  fields: [
    { type: 'row', fields: [
      { name: 'coach', type: 'relationship', relationTo: 'academy-coaches', required: true, index: true },
      { name: 'hourlyRate', label: 'Hourly rate (AUD)', type: 'number', required: true, min: 0 },
      { name: 'effectiveFrom', label: 'Effective from', type: 'text', required: true, index: true, admin: { description: 'YYYY-MM-DD' } },
    ] },
    { name: 'note', type: 'text' },
  ],
}

/** Pay details per coach (kept apart from the coach profile, which coaches can see). */
export const CoachPayProfiles: CollectionConfig = {
  slug: 'coach-pay-profiles',
  labels: { singular: 'Coach pay profile', plural: 'Coach pay profiles' },
  admin: { group, defaultColumns: ['coach', 'superOn', 'eaglesPaid'] },
  access: admin,
  hooks: audit('Coach pay profile'),
  fields: [
    { name: 'coach', type: 'relationship', relationTo: 'academy-coaches', required: true, unique: true, index: true },
    { type: 'row', fields: [
      { name: 'superOn', label: 'Super paid', type: 'checkbox', defaultValue: true },
      { name: 'eaglesPaid', label: 'Paid for Rowville Eagles team coaching', type: 'checkbox', defaultValue: false },
      { name: 'payrollActive', label: 'On the pay run', type: 'checkbox', defaultValue: true },
    ] },
    { type: 'row', fields: [
      { name: 'superFund', label: 'Super fund (reference)', type: 'text' },
      { name: 'xeroEmployee', label: 'Name in Xero Payroll (if different)', type: 'text' },
    ] },
    { name: 'notes', type: 'textarea' },
  ],
}

/** Hours Management adds or adjusts (admin, fit-out, events…), and cancelled sessions marked as paid. */
export const CoachHourAdjustments: CollectionConfig = {
  slug: 'coach-hour-adjustments',
  labels: { singular: 'Hours adjustment', plural: 'Hours adjustments' },
  admin: { group, defaultColumns: ['coach', 'date', 'kind', 'minutes', 'reason'] },
  access: admin,
  defaultSort: '-date',
  hooks: audit('Hours'),
  fields: [
    { type: 'row', fields: [
      { name: 'coach', type: 'relationship', relationTo: 'academy-coaches', required: true, index: true },
      { name: 'date', type: 'text', required: true, index: true, admin: { description: 'YYYY-MM-DD' } },
      { name: 'kind', type: 'select', required: true, defaultValue: 'manual', options: [{ label: 'Manual hours', value: 'manual' }, { label: 'Cancelled session — still paid', value: 'paid-cancellation' }] },
    ] },
    { type: 'row', fields: [
      { name: 'startTime', type: 'text', admin: { description: 'HH:MM (optional)' } },
      { name: 'minutes', label: 'Minutes (negative to take time off)', type: 'number', required: true },
      { name: 'sessionKey', type: 'text', index: true, admin: { description: 'The session this is for (cancelled-but-paid)' } },
    ] },
    { name: 'reason', type: 'text', required: true },
    { name: 'createdBy', type: 'relationship', relationTo: 'users', admin: readOnly },
  ],
}

/** A week's pay as calculated when it was reported (bonuses counted then — later refunds reverse them next week). */
export const PayWeeks: CollectionConfig = {
  slug: 'pay-weeks',
  labels: { singular: 'Pay week', plural: 'Pay weeks' },
  admin: { group, useAsTitle: 'weekStart', defaultColumns: ['weekStart', 'weekEnd', 'generatedAt'] },
  access: { read: isAdmin, create: () => false, update: () => false, delete: isAdmin },
  defaultSort: '-weekStart',
  fields: [
    { type: 'row', fields: [{ name: 'weekStart', type: 'text', required: true, unique: true, index: true }, { name: 'weekEnd', type: 'text', required: true }, { name: 'generatedAt', type: 'date' }] },
    { name: 'coaches', type: 'json', admin: { description: 'Per-coach totals: hours, base, bonus, super, total' } },
    { name: 'bonusKeys', type: 'json', admin: { description: 'Share-link bonuses counted this week (key → amount)' } },
    { name: 'reversedKeys', type: 'json', admin: { description: 'Earlier bonuses reversed this week' } },
  ],
}

export const FinanceReports: CollectionConfig = {
  slug: 'finance-reports',
  labels: { singular: 'Weekly finance report', plural: 'Weekly finance reports' },
  admin: { group, useAsTitle: 'periodStart', defaultColumns: ['periodStart', 'periodEnd', 'sentAt'] },
  access: { read: isAdmin, create: () => false, update: () => false, delete: isAdmin },
  defaultSort: '-periodStart',
  fields: [
    { type: 'row', fields: [{ name: 'periodStart', type: 'text', required: true, unique: true, index: true }, { name: 'periodEnd', type: 'text', required: true }, { name: 'sentAt', type: 'date' }] },
    { name: 'data', type: 'json' },
    { name: 'sentTo', type: 'text' },
  ],
}

export const ExpenseCategories: CollectionConfig = {
  slug: 'expense-categories',
  labels: { singular: 'Expense category', plural: 'Expense categories' },
  admin: { group, useAsTitle: 'name', defaultColumns: ['name', 'active', 'sortOrder'] },
  access: admin,
  defaultSort: 'sortOrder',
  fields: [{ type: 'row', fields: [{ name: 'name', type: 'text', required: true, unique: true }, { name: 'active', type: 'checkbox', defaultValue: true }, { name: 'sortOrder', type: 'number', defaultValue: 0 }] }],
}

/** Receipts and invoices (private files — admins only, never public). */
export const ReceiptFiles: CollectionConfig = {
  slug: 'receipt-files',
  labels: { singular: 'Receipt file', plural: 'Receipt files' },
  admin: { group, hidden: true },
  access: admin,
  upload: { mimeTypes: ['image/*', 'application/pdf'], disableLocalStorage: false },
  fields: [{ name: 'note', type: 'text' }],
}

export const Expenses: CollectionConfig = {
  slug: 'expenses',
  labels: { singular: 'Expense', plural: 'Expenses' },
  admin: { group, useAsTitle: 'supplier', defaultColumns: ['date', 'supplier', 'amount', 'category', 'status', 'source'], description: 'Use Management → Finance → Expenses.' },
  access: admin,
  defaultSort: '-date',
  hooks: audit('Expenses'),
  fields: [
    { type: 'row', fields: [
      { name: 'date', type: 'text', required: true, index: true, admin: { description: 'YYYY-MM-DD' } },
      { name: 'supplier', type: 'text', required: true, index: true },
      { name: 'amount', label: 'Amount incl. GST (AUD)', type: 'number', required: true },
      { name: 'gst', label: 'GST (AUD)', type: 'number' },
    ] },
    { name: 'description', type: 'text' },
    { type: 'row', fields: [
      { name: 'category', type: 'relationship', relationTo: 'expense-categories', index: true },
      { name: 'paymentMethod', type: 'select', options: ['card', 'bank transfer', 'direct debit', 'cash', 'other'] },
      { name: 'source', type: 'select', required: true, defaultValue: 'manual', options: ['email', 'photo', 'bank', 'manual'] },
      { name: 'status', type: 'select', required: true, defaultValue: 'needs_review', index: true, options: [{ label: 'Needs review', value: 'needs_review' }, { label: 'Approved', value: 'approved' }] },
    ] },
    { type: 'row', fields: [
      { name: 'recurring', label: 'Recurring (monthly)', type: 'checkbox', defaultValue: false },
      { name: 'receipt', type: 'upload', relationTo: 'receipt-files' },
      { name: 'bankTransaction', type: 'relationship', relationTo: 'bank-transactions', index: true },
    ] },
    { name: 'sourceRef', type: 'text', unique: true, admin: { description: 'Email message ID or upload ID (stops duplicates)' } },
    { name: 'notes', type: 'textarea' },
  ],
}

export const BankTransactions: CollectionConfig = {
  slug: 'bank-transactions',
  labels: { singular: 'Bank transaction', plural: 'Bank transactions' },
  admin: { group, useAsTitle: 'description', defaultColumns: ['date', 'description', 'amount', 'direction', 'status'] },
  access: admin,
  defaultSort: '-date',
  hooks: audit('Bank'),
  fields: [
    { type: 'row', fields: [
      { name: 'source', type: 'select', required: true, defaultValue: 'csv', options: ['csv', 'ofx', 'xero', 'open-banking'] },
      { name: 'account', type: 'text' },
      { name: 'date', type: 'text', required: true, index: true },
    ] },
    { name: 'description', type: 'text' },
    { type: 'row', fields: [
      { name: 'amount', label: 'Amount (AUD, positive)', type: 'number', required: true },
      { name: 'direction', type: 'select', required: true, options: ['debit', 'credit'] },
      { name: 'status', type: 'select', required: true, defaultValue: 'unmatched', index: true, options: [{ label: 'Unmatched', value: 'unmatched' }, { label: 'Matched', value: 'matched' }, { label: 'Not an expense', value: 'ignored' }, { label: 'Income transfer (e.g. Stripe payout)', value: 'income_transfer' }] },
    ] },
    { name: 'externalId', type: 'text', required: true, unique: true, index: true },
    { name: 'matchedExpense', type: 'relationship', relationTo: 'expenses' },
    { name: 'note', type: 'text' },
  ],
}

export const ProjectionScenarios: CollectionConfig = {
  slug: 'projection-scenarios',
  labels: { singular: 'Projection scenario', plural: 'Projection scenarios' },
  admin: { group, useAsTitle: 'name' },
  access: admin,
  fields: [{ name: 'name', type: 'text', required: true }, { name: 'inputs', type: 'json' }, { name: 'createdBy', type: 'relationship', relationTo: 'users', admin: readOnly }],
}

export const FinanceAuditLog: CollectionConfig = {
  slug: 'finance-audit-log',
  labels: { singular: 'Finance change', plural: 'Finance audit log' },
  admin: { group, defaultColumns: ['area', 'action', 'by', 'createdAt'] },
  access: { read: isAdmin, create: () => false, update: () => false, delete: () => false },
  defaultSort: '-createdAt',
  fields: [
    { type: 'row', fields: [{ name: 'area', type: 'text' }, { name: 'action', type: 'text' }, { name: 'collection', type: 'text' }, { name: 'docId', type: 'number' }] },
    { name: 'by', type: 'relationship', relationTo: 'users' },
    { name: 'reason', type: 'text' },
    { name: 'before', type: 'json' },
    { name: 'after', type: 'json' },
  ],
}

export const FinanceSettings: GlobalConfig = {
  slug: 'finance-settings',
  label: 'Finance settings',
  admin: { group },
  access: { read: isAdmin, update: isAdmin },
  fields: [
    { type: 'row', fields: [
      { name: 'superRate', label: 'Super guarantee rate (%)', type: 'number', defaultValue: 12, min: 0, max: 30 },
      { name: 'superOnBonus', label: 'Super on share-link bonuses', type: 'checkbox', defaultValue: true },
      { name: 'bonusPct', label: 'Share-link bonus (% of what the customer paid per session)', type: 'number', defaultValue: 10, min: 0, max: 100 },
    ] },
    { type: 'row', fields: [
      { name: 'setupMinutes', label: 'Setup (minutes before each block)', type: 'number', defaultValue: 15, min: 0, max: 120 },
      { name: 'packupMinutes', label: 'Pack-up (minutes after each block)', type: 'number', defaultValue: 15, min: 0, max: 120 },
      { name: 'blockGapMinutes', label: 'Gap allowed within a block (minutes)', type: 'number', defaultValue: 0, min: 0, max: 120 },
    ] },
    { name: 'setupKinds', label: 'Setup & pack-up applies to', type: 'select', hasMany: true, defaultValue: ['one-on-one', 'small-group', 'academy', 'mini-ballers', 'camp', 'eagles-training', 'eagles-game'], options: [
      { label: '1-on-1s', value: 'one-on-one' }, { label: 'Small groups', value: 'small-group' }, { label: 'Academy training', value: 'academy' }, { label: 'Mini Ballers', value: 'mini-ballers' }, { label: 'Holiday camps', value: 'camp' }, { label: 'Eagles training', value: 'eagles-training' }, { label: 'Eagles games', value: 'eagles-game' },
    ] },
    { type: 'row', fields: [
      { name: 'eaglesSeasonStart', label: 'Eagles training season from (YYYY-MM-DD)', type: 'text' },
      { name: 'eaglesSeasonEnd', label: 'to (YYYY-MM-DD)', type: 'text' },
      { name: 'eaglesGameMinutes', label: 'Eagles game length (minutes)', type: 'number', defaultValue: 90, min: 15 },
    ] },
    { type: 'row', fields: [
      { name: 'reportRecipients', label: 'Weekly report goes to (emails, comma-separated)', type: 'text' },
      { name: 'reportDay', type: 'select', defaultValue: '1', options: [{ label: 'Monday', value: '1' }, { label: 'Tuesday', value: '2' }, { label: 'Sunday', value: '0' }] },
      { name: 'reportHour', label: 'Hour (0–23, Melbourne)', type: 'number', defaultValue: 9, min: 0, max: 23 },
    ] },
    { name: 'gmail', type: 'group', admin: { description: 'Connected from Management → Finance → Settings' }, fields: [
      { type: 'row', fields: [{ name: 'email', type: 'text', admin: readOnly }, { name: 'connectedAt', type: 'date', admin: readOnly }, { name: 'lastCheckedAt', type: 'date', admin: readOnly }] },
      { name: 'refreshToken', type: 'text', admin: { hidden: true }, access: { read: () => false } },
      { name: 'lastError', type: 'text', admin: readOnly },
    ] },
  ],
}
