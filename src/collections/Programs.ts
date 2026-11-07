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

/** Which Stripe account is paid. Team registrations → Club; everything else → Academy (override per program). */
export const defaultPayee = (type?: string | null): 'club' | 'academy' => (type === 'registration' ? 'club' : 'academy')

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
  hooks: {
    beforeValidate: [
      async ({ data, req, originalDoc }) => {
        if (!data) return data
        // Academy group programs follow their shared term's dates
        // Partial updates (e.g. from the Prices page) only carry the changed fields
        const type = data.type ?? originalDoc?.type
        const termId = typeof data.academyTerm === 'object' ? data.academyTerm?.id : data.academyTerm
        if (type === 'academy-term' && termId) {
          const term = await req.payload.findByID({ collection: 'academy-terms', id: termId, depth: 0, req, disableErrors: true })
          if (term) {
            data.startDate = term.startDate
            data.endDate = term.endDate
          }
        }
        // Academy group terms are priced per session (default $25)
        if (type === 'academy-term' && data.pricePerSession == null && !originalDoc?.id) data.pricePerSession = 25
        return {
          ...data,
          payee: data.payee || originalDoc?.payee || defaultPayee(type),
          visibility: data.visibility || originalDoc?.visibility || (type === 'registration' ? 'offer-only' : 'public'),
        }
      },
    ],
  },
  fields: [
    {
      name: 'payee',
      label: 'Payments go to',
      type: 'select',
      options: [
        { label: 'Rowville Eagles FC (club Stripe account)', value: 'club' },
        { label: 'Rowville Foundation Academy (academy Stripe account)', value: 'academy' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Auto-set from program type: team registrations → Club; camps, tournaments, Academy, 1-on-1s → Academy.',
      },
    },
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
            { label: 'Rowville Foundation Academy', value: 'academy' },
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
    {
      name: 'visibility',
      type: 'select',
      options: [
        { label: 'Public — anyone can book', value: 'public' },
        { label: 'By offer only — after trials (team registrations)', value: 'offer-only' },
      ],
      admin: { position: 'sidebar', description: 'Team registrations default to "by offer only".' },
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
        {
          name: 'price',
          type: 'number',
          required: true,
          min: 0,
          defaultValue: 0,
          admin: {
            description: 'AUD incl. GST. Academy terms with training times charge the price per session instead.',
          },
        },
        {
          name: 'pricePerSession',
          label: 'Price per session (AUD)',
          type: 'number',
          min: 0,
          admin: {
            condition: (d) => d?.type === 'academy-term',
            description: 'Families pay this × the sessions left in their training time (like 1-on-1 terms), e.g. $25.',
          },
        },
        { name: 'capacity', type: 'number', min: 0 },
      ],
    },
    {
      name: 'priceNote',
      type: 'text',
      admin: { description: 'e.g. "Club fee only — FV fees paid in PlayFootball"' },
    },
    {
      name: 'slots',
      label: 'Bookable time slots',
      type: 'array',
      admin: {
        description: 'For 1-on-1s and trials: families pick one slot. Leave empty for programs with fixed dates.',
        condition: (d) => ['private-session', 'academy-trial'].includes(d?.type),
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'start', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
            { name: 'capacity', type: 'number', defaultValue: 1, min: 1 },
            { name: 'coach', type: 'text' },
          ],
        },
      ],
    },
    {
      name: 'academyTerm',
      label: 'Academy term',
      type: 'relationship',
      relationTo: 'academy-terms',
      admin: {
        condition: (d) => d?.type === 'academy-term',
        description: 'Start and end dates are taken from this term automatically.',
      },
    },
    {
      name: 'weeklySessions',
      label: 'Weekly training nights',
      type: 'array',
      admin: {
        description: 'Academy terms: the nights the program runs. Trial bookings are offered on these nights between the start and end dates.',
        condition: (d) => d?.type === 'academy-term',
      },
      fields: [
        { type: 'row', fields: [
          { name: 'day', type: 'select', required: true, options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
          { name: 'startTime', type: 'text', required: true, admin: { description: '24h, e.g. 17:30' } },
          { name: 'durationMinutes', type: 'number', defaultValue: 75 },
        ] },
        { type: 'row', fields: [
          { name: 'birthYears', label: 'Years of birth', type: 'number', hasMany: true, required: true, admin: { description: 'e.g. 2017, 2018' } },
          { name: 'trialSpots', label: 'Trial spots per age group', type: 'number', defaultValue: 3, min: 0, max: 10 },
        ] },
      ],
    },
    {
      name: 'trialPrice',
      label: 'Trial session price (AUD)',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: { condition: (d) => d?.type === 'academy-term', description: '0 = free trial' },
    },
    { name: 'heroImage', type: 'upload', relationTo: 'media' },
  ],
}
