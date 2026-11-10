import type { GlobalConfig } from 'payload'
import { refreshGlobal } from '../lib/revalidate'
import { isStaff } from '../access'
import { toE164 } from '../lib/sms'

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
          admin: { description: 'Camp age groups are worked out automatically from dates of birth: as few groups as possible, each within these sizes (one group if fewer children than the smallest size).' },
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'groupMin', label: 'Smallest group', type: 'number', defaultValue: 8, min: 1, max: 50 },
                { name: 'groupMax', label: 'Largest group', type: 'number', defaultValue: 12, min: 2, max: 50 },
              ],
            },
          ],
        },
      ],
    },
  ],
}
