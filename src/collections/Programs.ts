import type { CollectionConfig } from 'payload'
import { isStaff, publishedOrStaff } from '../access'

/**
 * Anything a family can book and pay for. One model, one checkout, one calendar:
 * season registrations, holiday camps, tournaments, Academy terms & trials, 1-on-1 sessions.
 */
export const programTypes = [
  { label: 'Season registration', value: 'registration' },
  { label: 'Holiday camp', value: 'holiday-camp' },
  { label: 'Tournament', value: 'tournament' },
  { label: 'Academy term', value: 'academy-term' },
  { label: 'Academy trial session', value: 'academy-trial' },
  { label: '1-on-1 session', value: 'private-session' },
] as const

export const Programs: CollectionConfig = {
  slug: 'programs',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'brand', 'startDate', 'status'],
    group: 'Programs & Bookings',
  },
  access: {
    read: publishedOrStaff('status', ['open', 'full', 'closed']),
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  defaultSort: 'startDate',
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    {
      type: 'row',
      fields: [
        { name: 'type', type: 'select', required: true, options: [...programTypes] },
        {
          name: 'brand',
          type: 'select',
          required: true,
          defaultValue: 'club',
          options: [
            { label: 'Rowville Eagles', value: 'club' },
            { label: 'Foundation Academy', value: 'academy' },
          ],
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'draft',
          options: [
            { label: 'Draft (hidden)', value: 'draft' },
            { label: 'Open for bookings', value: 'open' },
            { label: 'Full / waitlist', value: 'full' },
            { label: 'Closed', value: 'closed' },
          ],
        },
      ],
    },
    { name: 'summary', type: 'textarea', required: true, maxLength: 220 },
    { name: 'description', type: 'richText' },
    {
      type: 'row',
      fields: [
        { name: 'startDate', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'endDate', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
      ],
    },
    { name: 'scheduleNote', type: 'text', admin: { description: 'e.g. "Tuesdays 5–6pm, 8 weeks"' } },
    { name: 'location', type: 'text' },
    { name: 'ageRange', type: 'text', admin: { description: 'e.g. "Ages 6–12" or "U8–U13"' } },
    {
      type: 'row',
      fields: [
        { name: 'price', type: 'number', required: true, min: 0, admin: { description: 'AUD incl. GST' } },
        { name: 'capacity', type: 'number', min: 0 },
      ],
    },
    {
      name: 'priceNote',
      type: 'text',
      admin: { description: 'e.g. "Club fee only — FV fees paid in PlayFootball"' },
    },
    { name: 'heroImage', type: 'upload', relationTo: 'media' },
  ],
}
