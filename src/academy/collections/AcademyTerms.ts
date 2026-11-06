import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { anyone, isStaff } from '../../access'
import { DEFAULT_WEEKDAY_TIMES, DEFAULT_WEEKEND_TIMES, TIME_RE } from '../constants'
import { scheduleSummary, toYmd } from '../term-dates'
import { localToUtc } from '../../lib/time'

/**
 * Foundation Academy terms — shared by 1-on-1 coaching and Academy group programs.
 * Terms follow the school term dates, so the number of sessions varies by weekday (e.g. 9, 10 or 11)
 * and the term price is always price-per-session × sessions remaining.
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
        for (const t of [...(merged.slotStartTimes ?? []), ...(merged.weekendStartTimes ?? [])]) {
          if (!TIME_RE.test(t?.time ?? '')) throw new APIError(`Start time "${t?.time}" must be 24-hour HH:MM, e.g. 17:00.`, 400, undefined, true)
        }
        if (merged.startDate && merged.endDate) {
          const start = toYmd(merged.startDate)
          const end = toYmd(merged.endDate)
          if (end < start) throw new APIError('The end date must be on or after the start date.', 400, undefined, true)
          // Store the start/end as the very start/end of those days (Sydney time) so the last day counts in full
          data.startDate = localToUtc(start, '00:00').toISOString()
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
        { name: 'startDate', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' }, description: 'First day of the school term' } },
        { name: 'endDate', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' }, description: 'Last day of the school term' } },
      ],
    },
    {
      name: 'schedulePreview',
      type: 'textarea',
      virtual: true,
      admin: { readOnly: true, description: 'Number of sessions and dates for each weekday — this sets the term price per weekday (save to refresh)' },
      hooks: {
        afterRead: [({ siblingData }) => (siblingData?.startDate && siblingData?.endDate ? scheduleSummary({ startDate: siblingData.startDate, endDate: siblingData.endDate }) : '')],
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
        { type: 'row', fields: [
          {
            name: 'slotStartTimes',
            label: 'Weekday start times (Mon–Fri)',
            type: 'array',
            defaultValue: DEFAULT_WEEKDAY_TIMES.map((time) => ({ time })),
            admin: { description: '24-hour, e.g. 17:00. Default 3pm–9pm.', width: '50%' },
            fields: [{ name: 'time', type: 'text', required: true }],
          },
          {
            name: 'weekendStartTimes',
            label: 'Weekend start times (Sat & Sun)',
            type: 'array',
            defaultValue: DEFAULT_WEEKEND_TIMES.map((time) => ({ time })),
            admin: { description: '24-hour. Default 8am–5pm (last session starts 4pm).', width: '50%' },
            fields: [{ name: 'time', type: 'text', required: true }],
          },
        ] },
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
