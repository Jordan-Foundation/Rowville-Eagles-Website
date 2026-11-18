import type { GlobalConfig } from 'payload'
import { refreshGlobal } from '../lib/revalidate'
import { isStaff } from '../access'
import { toE164 } from '../lib/sms'
import { TIME_RE } from './hours'

const hhmm = (v: unknown) => !v || TIME_RE.test(String(v)) || 'Use 24-hour time, e.g. 16:00'

/** Foundation Academy settings that aren't tied to a term. */
export const AcademySettings: GlobalConfig = {
  slug: 'academy-settings',
  label: 'Academy settings',
  admin: { group: 'Foundation Academy' },
  access: { read: isStaff, update: isStaff },
  hooks: { afterChange: [refreshGlobal] },
  fields: [
    {
      type: 'collapsible',
      label: '1-on-1 booking hours',
      fields: [
        {
          name: 'bookingHours',
          type: 'group',
          label: false,
          admin: { description: 'Sessions run back to back inside these hours (1-hour sessions in 4pm–9pm → 4, 5, 6, 7 and 8pm). A coach’s availability is only bookable inside them. School terms come from the Timeframes (Yearly setup); any date outside a school term uses the holiday hours. 24-hour times, e.g. 16:00.' },
          fields: [
            { type: 'row', fields: [
              { name: 'termWeekdayFrom', label: 'School term Mon–Fri from', type: 'text', defaultValue: '16:00', validate: hhmm },
              { name: 'termWeekdayTo', label: 'until', type: 'text', defaultValue: '21:00', validate: hhmm },
            ] },
            { type: 'row', fields: [
              { name: 'termWeekendFrom', label: 'School term Sat & Sun from', type: 'text', defaultValue: '07:00', validate: hhmm },
              { name: 'termWeekendTo', label: 'until', type: 'text', defaultValue: '21:00', validate: hhmm },
            ] },
            { type: 'row', fields: [
              { name: 'holidayFrom', label: 'School holidays (every day) from', type: 'text', defaultValue: '07:00', validate: hhmm },
              { name: 'holidayTo', label: 'until', type: 'text', defaultValue: '21:00', validate: hhmm },
            ] },
          ],
        },
        {
          name: 'closedDates',
          label: 'Closed dates (no 1-on-1s or small groups)',
          type: 'array',
          admin: { description: 'e.g. Christmas Day. No times show on these dates.' },
          fields: [{ type: 'row', fields: [
            { name: 'date', type: 'date', required: true, admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' } } },
            { name: 'note', type: 'text' },
          ] }],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Back-to-back booking',
      fields: [
        {
          name: 'backToBack',
          type: 'group',
          label: false,
          admin: { description: 'On the family booking pages, once a coach has a booking on a day, only the times directly before or after their bookings are shown, so sessions fill up back to back. Management and coaches booking internally always see every time. Nothing is deleted — times are only hidden. Switch it off for one coach on their coach record.' },
          fields: [
            { name: 'enabled', label: 'Use back-to-back booking', type: 'checkbox', defaultValue: true },
            {
              name: 'appliesTo',
              label: 'Applies to',
              type: 'select',
              hasMany: true,
              defaultValue: ['casual', 'term', 'pack'],
              options: [
                { label: 'One-off 1-on-1s', value: 'casual' },
                { label: 'Weekly 1-on-1s for the term', value: 'term' },
                { label: 'Holiday 1-on-1 packs', value: 'pack' },
              ],
              admin: { description: 'Small groups are set up by coaches and Management, so they can always use any time.' },
            },
            { name: 'releaseHours', label: 'Show every time again this many hours before the day (0 = off)', type: 'number', defaultValue: 0, min: 0, max: 336 },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Phone calls',
      fields: [
        {
          name: 'callForwardTo',
          label: 'Forward calls to',
          type: 'text',
          admin: {
            description: 'Calls to the Twilio number ring this mobile (e.g. 0451 525 684). If nobody answers within 20 seconds the caller hears the Foundation Academy voicemail, and the message is emailed to the academy inbox. Leave empty to use the CALL_FORWARD_TO setting in Vercel.',
          },
          validate: (v: unknown) => !v || toE164(String(v)) !== null || 'Enter an Australian mobile, e.g. 0451 525 684',
        },
        {
          name: 'voicemailGreeting',
          label: 'Voicemail greeting',
          type: 'textarea',
          defaultValue: 'Thanks for calling Foundation Academy. We can’t take your call right now. Please leave your name, your child’s name and a message after the tone, and we’ll call you back as soon as we can.',
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Google review request',
      fields: [
        {
          name: 'googleReviewUrl',
          label: 'Google review link',
          type: 'text',
          admin: {
            description: 'From your Google Business Profile: “Ask for reviews” → copy the link (looks like https://g.page/r/…/review). Nothing is sent until this is filled in.',
          },
          validate: (v: unknown) => !v || /^https:\/\/\S+$/.test(String(v)) || 'Paste the full https:// link',
        },
        { name: 'reviewAfterSessions', label: 'Ask after this many attended 1-on-1s', type: 'number', defaultValue: 12, min: 1, max: 100 },
        { name: 'reviewRequestsOn', label: 'Send review requests', type: 'checkbox', defaultValue: true },
      ],
    },
    {
      type: 'collapsible',
      label: 'Small group sessions',
      fields: [
        {
          name: 'groupSessions',
          type: 'group',
          label: false,
          admin: { description: 'Price per player, per session. Term groups pay the casual rate less the term discount. Also editable on Management → Set prices.' },
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'casual2', label: '2 players', type: 'number', defaultValue: 70, min: 0, required: true },
                { name: 'casual3', label: '3 players', type: 'number', defaultValue: 60, min: 0, required: true },
                { name: 'casual4', label: '4 players', type: 'number', defaultValue: 50, min: 0, required: true },
                { name: 'casual5', label: '5 players', type: 'number', defaultValue: 40, min: 0, required: true },
              ],
            },
            { name: 'termDiscountPct', label: 'Term discount (%)', type: 'number', defaultValue: 10, min: 0, max: 100, required: true },
            { name: 'inviteDeadlineHours', label: 'Families have this many hours to pay', type: 'number', defaultValue: 48, min: 1, max: 336, required: true },
            { name: 'reminderHoursBefore', label: 'Remind this many hours before the deadline', type: 'number', defaultValue: 12, min: 0, max: 336, required: true },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Holiday camps',
      fields: [
        {
          name: 'camps',
          type: 'group',
          label: false,
          admin: { description: 'Camp age groups are worked out automatically from dates of birth: as few groups as possible, each within these sizes (one group if fewer children than the smallest size). Coaches needed = groups on the busiest day × coaches per group + extra coaches.' },
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'groupMin', label: 'Smallest group', type: 'number', defaultValue: 8, min: 1, max: 50 },
                { name: 'groupMax', label: 'Largest group', type: 'number', defaultValue: 12, min: 2, max: 50 },
              ],
            },
            {
              type: 'row',
              fields: [
                { name: 'coachesPerGroup', label: 'Coaches per group', type: 'number', defaultValue: 1, min: 0, max: 10 },
                { name: 'extraCoaches', label: 'Extra coaches per camp', type: 'number', defaultValue: 1, min: 0, max: 20, admin: { description: 'On top of one per group (a camp can change this)' } },
                { name: 'confirmReminderHours', label: 'Remind coaches after (hours)', type: 'number', defaultValue: 24, min: 1, max: 336 },
                { name: 'escalateHours', label: 'Tell Management after (hours)', type: 'number', defaultValue: 48, min: 1, max: 336 },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Academy fees note',
      fields: [
        { name: 'clubRegistrationFee', label: 'Rowville Eagles player registration (AUD)', type: 'number', defaultValue: 950, min: 0, admin: { description: 'Shown on every Academy program page, card and checkout: “Academy-only players don’t pay the $950 Rowville Eagles player registration — it’s only for players in a Rowville Eagles club team.”' } },
      ],
    },
  ],
}
