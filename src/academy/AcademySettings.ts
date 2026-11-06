import type { GlobalConfig } from 'payload'
import { isStaff } from '../access'

/** Foundation Academy settings that aren't tied to a term. */
export const AcademySettings: GlobalConfig = {
  slug: 'academy-settings',
  label: 'Academy settings',
  admin: { group: 'Foundation Academy' },
  access: { read: isStaff, update: isStaff },
  fields: [
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
  ],
}
