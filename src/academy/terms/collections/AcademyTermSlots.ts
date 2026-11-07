import type { CollectionConfig } from 'payload'
import { isStaff } from '../../../access'
import { TIME_RE, weekdayOptions } from '../../constants'
import { slotLabel, yearsLabel } from '../slots'

/**
 * A weekly training time within an Academy term program, for certain years of birth,
 * e.g. "Tuesday 5–6pm · Rowville Reserve · 2017s & 2018s · 24 places".
 */
export const AcademyTermSlots: CollectionConfig = {
  slug: 'academy-term-slots',
  labels: { singular: 'Term time slot', plural: 'Term time slots' },
  admin: {
    group: 'Foundation Academy',
    useAsTitle: 'title',
    defaultColumns: ['title', 'program', 'capacity', 'active'],
    description: 'Weekly training times for Academy term programs. Families are placed in a slot by their year of birth.',
  },
  access: { read: () => true, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: 'program',
  hooks: {
    beforeValidate: [
      ({ data, originalDoc }) => {
        if (!data) return data
        const m = { ...originalDoc, ...data }
        if (m.weekday && m.startTime && m.endTime) data.title = `${slotLabel(m)} · ${yearsLabel(m.birthYears)}`
        return data
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', admin: { readOnly: true, hidden: true } },
    {
      name: 'program',
      type: 'relationship',
      relationTo: 'programs',
      required: true,
      index: true,
      filterOptions: { type: { equals: 'academy-term' } },
      admin: { description: 'The Academy term program (its dates come from the linked Academy term).' },
    },
    {
      type: 'row',
      fields: [
        { name: 'weekday', type: 'select', required: true, options: weekdayOptions },
        { name: 'startTime', type: 'text', required: true, admin: { description: '24h, e.g. 17:00' }, validate: (v: unknown) => TIME_RE.test(String(v ?? '')) || 'Use 24h time, e.g. 17:00' },
        { name: 'endTime', type: 'text', required: true, admin: { description: '24h, e.g. 18:00' }, validate: (v: unknown) => TIME_RE.test(String(v ?? '')) || 'Use 24h time, e.g. 18:00' },
      ],
    },
    { name: 'venue', type: 'text' },
    {
      type: 'row',
      fields: [
        { name: 'birthYears', label: 'Years of birth', type: 'number', hasMany: true, required: true, admin: { description: 'e.g. 2017, 2018' } },
        { name: 'capacity', label: 'Places', type: 'number', min: 1, admin: { description: 'Leave empty for no limit' } },
      ],
    },
    { name: 'active', label: 'Taking registrations', type: 'checkbox', defaultValue: true },
    {
      name: 'groups',
      type: 'array',
      admin: { description: 'Optional: split the slot into groups, each with its own coaches.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'name', type: 'text', required: true, admin: { description: 'e.g. Group A' } },
            { name: 'coaches', type: 'relationship', relationTo: 'academy-coaches', hasMany: true },
          ],
        },
      ],
    },
    {
      name: 'exceptions',
      label: 'Week changes',
      type: 'array',
      admin: { description: 'Cancel or move a single week. Changing the slot’s day/time above changes every week.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'date', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
            { name: 'cancelled', type: 'checkbox' },
            { name: 'startTime', type: 'text', admin: { description: 'New start (optional)' } },
            { name: 'endTime', type: 'text', admin: { description: 'New end (optional)' } },
          ],
        },
        { name: 'note', type: 'text', admin: { description: 'Shown to families, e.g. “Pitch closed — public holiday”' } },
      ],
    },
  ],
}
