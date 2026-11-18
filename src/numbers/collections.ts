import type { CollectionConfig } from 'payload'
import { isStaff } from '../access'
import { rangeProblem } from './rules'

const group = 'Kit & numbers'

/** Each junior/MiniRoos year of birth's shirt-number range — stored so it never shifts between seasons. */
export const NumberRanges: CollectionConfig = {
  slug: 'number-ranges',
  labels: { singular: 'Number range', plural: 'Number ranges' },
  admin: { group, useAsTitle: 'label', defaultColumns: ['birthYear', 'start', 'end'], description: 'Use Management → Kit & numbers → Number ranges.' },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: '-birthYear',
  hooks: { beforeChange: [({ data }) => ({ ...data, label: `Born ${data.birthYear}: ${data.start}–${data.end}` })] },
  fields: [
    { name: 'label', type: 'text', admin: { hidden: true } },
    { name: 'birthYear', type: 'number', required: true, unique: true, index: true },
    { type: 'row', fields: [
      { name: 'start', type: 'number', required: true },
      { name: 'end', type: 'number', required: true, validate: (v: unknown, { siblingData }: { siblingData: Record<string, unknown> }) => rangeProblem({ start: Number(siblingData.start), end: Number(v) }) ?? true },
    ] },
  ],
}

/**
 * A player's shirt number. While held (10 minutes while choosing) or active, `slot` = "<year>-<number>" is unique, so the
 * database itself stops two players in the same year of birth having the same number. Released rows keep the history.
 */
export const PlayerNumbers: CollectionConfig = {
  slug: 'player-numbers',
  labels: { singular: 'Player number', plural: 'Player numbers' },
  admin: { group, useAsTitle: 'slot', defaultColumns: ['participant', 'number', 'birthYear', 'status'], description: 'Use Management → Kit & numbers → Player numbers.' },
  access: { read: isStaff, create: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'participant', type: 'relationship', relationTo: 'participants', required: true, index: true },
    { type: 'row', fields: [
      { name: 'birthYear', type: 'number', required: true, index: true },
      { name: 'number', type: 'number', required: true, min: 2, max: 99 },
      { name: 'status', type: 'select', required: true, index: true, options: [{ label: 'Held (choosing)', value: 'held' }, { label: 'Active', value: 'active' }, { label: 'Released', value: 'released' }] },
    ] },
    { name: 'slot', type: 'text', unique: true, index: true, admin: { readOnly: true, description: 'Set while held or active; cleared when released' } },
    { type: 'row', fields: [
      { name: 'heldUntil', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'assignedAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
      { name: 'releasedAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    ] },
    { name: 'assignedBy', type: 'select', options: ['player', 'admin'] },
  ],
}

export const NumberAudit: CollectionConfig = {
  slug: 'number-audit-log',
  labels: { singular: 'Number change', plural: 'Number changes' },
  admin: { group, defaultColumns: ['participant', 'action', 'oldNumber', 'newNumber', 'createdAt'] },
  access: { read: isStaff, create: () => false, update: () => false, delete: () => false },
  defaultSort: '-createdAt',
  fields: [
    { name: 'participant', type: 'relationship', relationTo: 'participants', required: true, index: true },
    { name: 'action', type: 'select', required: true, options: ['picked', 'assigned', 'changed', 'released', 'released-inactive'] },
    { type: 'row', fields: [{ name: 'oldNumber', type: 'number' }, { name: 'newNumber', type: 'number' }, { name: 'birthYear', type: 'number' }] },
    { name: 'by', type: 'relationship', relationTo: 'users' },
    { name: 'note', type: 'text' },
  ],
}

// ── Fitout ──────────────────────────────────────────────────────────────────────
/** Kit items and their sizes (Management → Kit & numbers → Kit items). */
export const KitItems: CollectionConfig = {
  slug: 'kit-items',
  labels: { singular: 'Kit item', plural: 'Kit items' },
  admin: { group, useAsTitle: 'name', defaultColumns: ['name', 'active', 'sortOrder'] },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: 'sortOrder',
  fields: [
    { type: 'row', fields: [{ name: 'name', type: 'text', required: true }, { name: 'sortOrder', type: 'number', defaultValue: 0 }, { name: 'active', type: 'checkbox', defaultValue: true }] },
    { name: 'sizes', type: 'array', minRows: 1, fields: [{ name: 'label', type: 'text', required: true }] },
  ],
}

export const FitoutSessions: CollectionConfig = {
  slug: 'fitout-sessions',
  labels: { singular: 'Fitout session', plural: 'Fitout sessions' },
  admin: { group, useAsTitle: 'name', defaultColumns: ['name', 'date', 'program'] },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: '-date',
  fields: [
    { type: 'row', fields: [{ name: 'name', type: 'text', required: true }, { name: 'date', type: 'date', required: true }, { name: 'program', type: 'select', defaultValue: 'both', options: [{ label: 'RFA and Rowville', value: 'both' }, { label: 'RFA', value: 'rfa' }, { label: 'Rowville', value: 'rowville' }] }] },
    { name: 'createdBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
  ],
}

/** One player's sizes in one fitout session (one row per player per session). */
export const FitoutEntries: CollectionConfig = {
  slug: 'fitout-entries',
  labels: { singular: 'Fitout entry', plural: 'Fitout entries' },
  admin: { group, useAsTitle: 'key', defaultColumns: ['session', 'participant', 'updatedAt', 'exportedAt'] },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  fields: [
    { name: 'key', type: 'text', unique: true, index: true, admin: { readOnly: true, description: '<session>-<player>' } },
    { name: 'session', type: 'relationship', relationTo: 'fitout-sessions', required: true, index: true },
    { name: 'participant', type: 'relationship', relationTo: 'participants', required: true, index: true },
    { name: 'sizes', type: 'array', fields: [{ name: 'item', type: 'relationship', relationTo: 'kit-items', required: true }, { name: 'size', type: 'text', required: true }] },
    { name: 'notes', type: 'text' },
    { type: 'row', fields: [{ name: 'updatedBy', type: 'relationship', relationTo: 'users' }, { name: 'exportedAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } }] },
  ],
}
