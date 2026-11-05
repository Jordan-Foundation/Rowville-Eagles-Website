import type { CollectionConfig } from 'payload'
import { anyone, isStaff } from '../access'
import { ageGroupOptions } from '../lib/age'
import { notifyInterestsOfTrial } from '../lib/trials'

/** Club trial dates. Publishing one emails everyone who registered interest in a matching age group. */
export const TrialSessions: CollectionConfig = {
  slug: 'trial-sessions',
  labels: { singular: 'Club trial date', plural: 'Club trial dates' },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'start', 'ageGroups', 'status'], group: 'Trials & Registration' },
  access: { read: anyone, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: 'start',
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        if (doc.status === 'published' && previousDoc?.status !== 'published') {
          await notifyInterestsOfTrial(req.payload, doc)
        }
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', required: true, admin: { description: 'e.g. "MiniRoos trials — night 1"' } },
    {
      type: 'row',
      fields: [
        { name: 'start', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
        { name: 'durationMinutes', type: 'number', defaultValue: 60 },
        { name: 'capacityPerAgeGroup', type: 'number', defaultValue: 20, min: 1 },
      ],
    },
    { name: 'ageGroups', type: 'select', hasMany: true, required: true, options: ageGroupOptions },
    { name: 'location', type: 'text', defaultValue: '208 Dandelion Drive, Rowville' },
    { name: 'whatToBring', type: 'textarea', defaultValue: 'Boots, shin pads, water bottle and a ball if you have one. Please arrive 10 minutes early.' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft (hidden)', value: 'draft' },
        { label: 'Published — open for trial bookings', value: 'published' },
        { label: 'Closed', value: 'closed' },
      ],
      admin: { position: 'sidebar', description: 'Publishing emails everyone on the interest list for these age groups.' },
    },
  ],
}
