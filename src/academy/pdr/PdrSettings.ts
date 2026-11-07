import type { GlobalConfig } from 'payload'
import { isStaff } from '../../access'

export const PdrSettings: GlobalConfig = {
  slug: 'pdr-settings',
  label: 'Foundation+ settings',
  admin: { group: 'Foundation+' },
  access: { read: () => true, update: isStaff },
  fields: [
    {
      name: 'enabled',
      label: 'Show Foundation+ on the website',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Off: families can’t see it anywhere (no pages, links or menu items). Staff and coaches can still preview it at /foundation-plus.' },
    },
    {
      type: 'row',
      fields: [
        { name: 'programName', label: 'Program name', type: 'text', required: true, defaultValue: 'Foundation+', admin: { description: 'Shown to families everywhere, e.g. Foundation+' } },
        { name: 'tagline', type: 'text', defaultValue: 'Level up your game — skills, challenges, badges and coach feedback.' },
      ],
    },
    {
      type: 'collapsible',
      label: 'Video submissions',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'maxClipSeconds', label: 'Longest clip (seconds)', type: 'number', defaultValue: 90, min: 10, max: 600 },
            { name: 'maxFileMB', label: 'Largest file (MB)', type: 'number', defaultValue: 200, min: 10, max: 2000 },
            { name: 'retentionMonths', label: 'Delete videos after review (months)', type: 'number', defaultValue: 6, min: 1, max: 36 },
          ],
        },
        { name: 'feedbackPerMonth', label: 'Premium feedback-only videos per month', type: 'number', defaultValue: 2, min: 0 },
      ],
    },
    {
      type: 'collapsible',
      label: 'Rankings',
      fields: [{ name: 'minPlayersForRanking', label: 'Show a ranking once this many players have passed a stage', type: 'number', defaultValue: 5, min: 1 }],
    },
  ],
}
