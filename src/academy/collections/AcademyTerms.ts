import type { CollectionConfig } from 'payload'
import { refreshAfterChange, refreshAfterDelete } from '../../lib/revalidate'
import { APIError } from 'payload'
import { anyone, isStaff } from '../../access'
import { DEFAULT_WEEKDAY_TIMES, DEFAULT_WEEKEND_TIMES, TIME_RE } from '../constants'
import { scheduleSummary, toYmd } from '../term-dates'
import { localToUtc, localYmd } from '../../lib/time'
import { TIMEFRAME_CATEGORIES, TIMEFRAME_PERIODS, categoryOfPeriod, periodFromName } from '../timeframes'

/**
 * Timeframes — the Academy calendar: school terms (Terms 1–4) and school holidays.
 * 1-on-1s and small groups run in every timeframe; Academy training programs only in school terms;
 * holiday camps sit inside a holiday timeframe. The slug stays `academy-terms` so existing records keep working.
 * Terms follow the school term dates, so the number of sessions varies by weekday (e.g. 9, 10 or 11)
 * and the term price is always price-per-session × sessions remaining.
 */
export const AcademyTerms: CollectionConfig = {
  slug: 'academy-terms',
  labels: { singular: 'Timeframe', plural: 'Timeframes' },
  admin: {
    group: 'Foundation Academy',
    useAsTitle: 'name',
    defaultColumns: ['name', 'category', 'startDate', 'endDate', 'availabilityDeadline', 'status'],
    description: 'School terms and school holidays. Coaches set 1-on-1 availability for each one; Academy programs use school terms; camps sit in the holidays.',
  },
  access: { read: anyone, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: '-startDate',
  hooks: {
    afterChange: [refreshAfterChange],
    afterDelete: [refreshAfterDelete],
    beforeValidate: [
      ({ data, originalDoc }) => {
        if (!data) return data
        const merged = { ...originalDoc, ...data }
        // Period from the name if not chosen; the category always follows the period
        const period = merged.period || periodFromName(merged.name)
        if (period && !merged.period) data.period = period
        const category = categoryOfPeriod(period)
        if (category) data.category = category
        else if (!merged.category) data.category = 'school-term'
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
          // The year it belongs to: the year it starts in (summer holidays starting in December count for the next year)
          const y = Number(localYmd(new Date(data.startDate)).slice(0, 4))
          data.year = period === 'summer' && localYmd(new Date(data.startDate)).slice(5, 7) === '12' ? y + 1 : y
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true, admin: { description: 'e.g. "Term 1 2027" or "April holidays 2027"' } },
    {
      type: 'row',
      fields: [
        {
          name: 'period',
          label: 'Which term or holidays',
          type: 'select',
          options: TIMEFRAME_PERIODS.map((p) => ({ label: p.label, value: p.value })),
          admin: { description: 'Worked out from the name if left blank' },
        },
        {
          name: 'category',
          label: 'Type',
          type: 'select',
          required: true,
          defaultValue: 'school-term',
          index: true,
          options: TIMEFRAME_CATEGORIES,
          admin: { readOnly: true, description: 'Set from the term or holidays chosen' },
        },
        { name: 'year', type: 'number', index: true, admin: { readOnly: true, description: 'Set from the start date' } },
      ],
    },
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
        { name: 'startDate', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' }, description: 'First day of the term or holidays' } },
        { name: 'endDate', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' }, description: 'Last day of the term or holidays' } },
      ],
    },
    {
      name: 'schedulePreview',
      type: 'textarea',
      virtual: true,
      admin: { readOnly: true, description: 'Number of sessions and dates for each weekday — for school terms this sets the term price per weekday (save to refresh)' },
      hooks: {
        afterRead: [({ siblingData }) => (siblingData?.startDate && siblingData?.endDate ? scheduleSummary({ startDate: siblingData.startDate, endDate: siblingData.endDate }) : '')],
      },
    },
    {
      name: 'availabilityDeadline',
      type: 'date',
      required: true,
      admin: { date: { pickerAppearance: 'dayAndTime' }, description: 'Coaches must submit their 1-on-1 and small group availability for this timeframe by this date. Reminders go out 2 weeks, 1 week, 3 days and 1 day before.' },
    },
    {
      type: 'collapsible',
      label: '1-on-1 pricing & booking rules',
      fields: [
        { name: 'location', type: 'text', defaultValue: '208 Dandelion Drive, Rowville VIC 3178', admin: { description: 'Where 1-on-1 sessions are held (shown in confirmations and reminders)' } },
        { type: 'row', fields: [
          { name: 'pricePerSession', label: 'Term price per session (AUD)', type: 'number', required: true, defaultValue: 80, min: 0 },
          { name: 'casualPrice', label: 'Casual session price (AUD)', type: 'number', required: true, defaultValue: 85, min: 0 },
          {
            name: 'termMemberPrice',
            label: 'Term member casual price (AUD)',
            type: 'number',
            required: true,
            defaultValue: 70,
            min: 0,
            admin: { description: 'Casual price for families with an active term booking' },
          },
          {
            name: 'termMemberWindowDays',
            label: 'Term member price window (days)',
            type: 'number',
            required: true,
            defaultValue: 14,
            min: 1,
            max: 90,
            admin: { description: 'Only for sessions starting within this many days of booking' },
          },
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
          { name: 'holdMinutes', label: 'Checkout hold (minutes)', type: 'number', defaultValue: 30, min: 30, max: 60, admin: { description: 'Stripe checkout links last at least 30 minutes' } },
        ] },
        { type: 'row', fields: [
          { name: 'shareLinkHoldHours', label: 'Default coach share-link hold (hours)', type: 'number', defaultValue: 24, min: 0, max: 72 },
          { name: 'accountReminderDays', label: 'Create-account reminder after (days)', type: 'number', defaultValue: 3, min: 1 },
        ] },
      ],
    },
    {
      type: 'collapsible',
      label: 'Holiday packs (school holidays only)',
      admin: { condition: (d) => d?.category === 'school-holidays' || ['summer', 'april', 'mid-year', 'september'].includes(d?.period) },
      fields: [
        { type: 'row', fields: [
          { name: 'packSizes', label: 'Pack sizes', type: 'text', defaultValue: '3, 5', admin: { description: 'Sessions in a pack, e.g. "3, 5". Families choose any free times with one coach across the break and pay upfront.' } },
          { name: 'packPricePerSession', label: 'Pack price per session (AUD)', type: 'number', defaultValue: 80, min: 0 },
        ] },
      ],
    },
    { name: 'organisation', type: 'text', defaultValue: 'rowville', admin: { position: 'sidebar', readOnly: true } },
  ],
}
