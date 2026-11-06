import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { anyone, isStaff } from '../../access'
import { DEFAULT_SLOT_TIMES, TIME_RE } from '../constants'
import { scheduleSummary, termEndDate } from '../term-dates'
import { localToUtc } from '../../lib/time'

/**
 * Foundation Academy terms — shared by 1-on-1 coaching and Academy group programs.
 * Always 10 sessions per weekday; skipped dates (breaks / public holidays) push the term later.
 */
export const AcademyTerms: CollectionConfig = {
  slug: 'academy-terms',
  labels: { singular: 'Academy term', plural: 'Academy terms' },
  admin: { group: 'Foundation Academy', useAsTitle: 'name', defaultColumns: ['name', 'startDate', 'endDate', 'availabilityDeadline', 'status'] },
  access: { read: anyone, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: '-startDate',
  hooks: {
    beforeValidate: [
      ({ data, originalDoc }) => {
        if (!data) return data
        const merged = { ...originalDoc, ...data }
        for (const t of merged.slotStartTimes ?? []) {
          if (!TIME_RE.test(t?.time ?? '')) throw new APIError(`Start time "${t?.time}" must be 24-hour HH:MM, e.g. 17:00.`, 400, undefined, true)
        }
        if (merged.startDate && merged.sessions) {
          const end = termEndDate({ startDate: merged.startDate, sessions: merged.sessions, skipDates: (merged.skipDates ?? []).map((s: { date: string }) => s.date) })
          // Store the end as the evening of the last session day so "ends after now" queries work all day
          data.endDate = localToUtc(end, '23:59').toISOString()
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true, admin: { description: 'e.g. "Term 1 2027"' } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft (hidden)', value: 'draft' },
        { label: 'Collecting coach availability', value: 'availability' },
        { label: 'Open for bookings', value: 'open' },
        { label: 'Closed', value: 'closed' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      type: 'row',
      fields: [
        { name: 'startDate', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' }, description: 'First day of the term' } },
        { name: 'sessions', label: 'Sessions per weekday', type: 'number', required: true, defaultValue: 10, min: 1, max: 20 },
        { name: 'endDate', type: 'date', admin: { readOnly: true, date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' }, description: 'Worked out automatically' } },
      ],
    },
    {
      name: 'skipDates',
      label: 'Skipped dates (breaks / public holidays)',
      type: 'array',
      admin: { description: 'No sessions on these days. That weekday runs one week later so it still gets the full number of sessions.' },
      fields: [
        { type: 'row', fields: [
          { name: 'date', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
          { name: 'reason', type: 'text' },
        ] },
      ],
    },
    {
      name: 'schedulePreview',
      type: 'textarea',
      virtual: true,
      admin: { readOnly: true, description: 'Session dates for each weekday (save to refresh)' },
      hooks: {
        afterRead: [
          ({ siblingData }) =>
            siblingData?.startDate && siblingData?.sessions
              ? scheduleSummary({ startDate: siblingData.startDate, sessions: siblingData.sessions, skipDates: (siblingData.skipDates ?? []).map((s: { date: string }) => s.date) })
              : '',
        ],
      },
    },
    {
      name: 'availabilityDeadline',
      type: 'date',
      required: true,
      admin: { date: { pickerAppearance: 'dayAndTime' }, description: 'Coaches must submit their 1-on-1 availability by this date. Reminders go out 2 weeks, 1 week, 3 days and 1 day before.' },
    },
    {
      type: 'collapsible',
      label: '1-on-1 pricing & booking rules',
      fields: [
        { type: 'row', fields: [
          { name: 'pricePerSession', label: 'Term price per session (AUD)', type: 'number', required: true, defaultValue: 80, min: 0 },
          { name: 'casualPrice', label: 'Casual session price (AUD)', type: 'number', required: true, defaultValue: 85, min: 0 },
          { name: 'sessionMinutes', type: 'number', required: true, defaultValue: 60, min: 15 },
        ] },
        {
          name: 'slotStartTimes',
          label: 'Session start times',
          type: 'array',
          defaultValue: DEFAULT_SLOT_TIMES.map((time) => ({ time })),
          admin: { description: 'Fixed start times coaches can choose from (24-hour, e.g. 17:00).' },
          fields: [{ name: 'time', type: 'text', required: true }],
        },
        { type: 'row', fields: [
          { name: 'bookingCutoffHours', label: 'Booking cut-off (hours before a session)', type: 'number', defaultValue: 24, min: 0 },
          { name: 'minTermSessions', label: 'Minimum sessions left to book a term', type: 'number', defaultValue: 2, min: 1 },
          { name: 'holdMinutes', label: 'Checkout hold (minutes)', type: 'number', defaultValue: 15, min: 5, max: 60 },
        ] },
        { type: 'row', fields: [
          { name: 'shareLinkHoldHours', label: 'Default coach share-link hold (hours)', type: 'number', defaultValue: 24, min: 0, max: 72 },
          { name: 'accountReminderDays', label: 'Create-account reminder after (days)', type: 'number', defaultValue: 3, min: 1 },
        ] },
      ],
    },
    { name: 'organisation', type: 'text', defaultValue: 'rowville', admin: { position: 'sidebar', readOnly: true } },
  ],
}
