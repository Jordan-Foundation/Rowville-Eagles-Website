import type { CollectionConfig } from 'payload'
import { isStaff } from '../../../access'

/**
 * Tutorial and demonstration clips, hosted on Cloudflare Stream (never in the site's own storage).
 * Paste the video's ID from the Stream dashboard; the player plays it with a signed, short-lived link.
 */
export const PdrVideos: CollectionConfig = {
  slug: 'pdr-videos',
  labels: { singular: 'Video', plural: 'Video library' },
  admin: { group: 'Foundation+', useAsTitle: 'title', defaultColumns: ['title', 'kind', 'durationSec', 'streamUid'] },
  access: { read: () => true, create: isStaff, update: isStaff, delete: isStaff },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'kind', type: 'select', defaultValue: 'tutorial', options: [{ label: 'Tutorial', value: 'tutorial' }, { label: 'Demonstration', value: 'demo' }, { label: 'Challenge demo', value: 'challenge' }] },
        { name: 'durationSec', label: 'Length (seconds)', type: 'number', min: 0 },
      ],
    },
    {
      name: 'streamUid',
      label: 'Cloudflare Stream video ID',
      type: 'text',
      index: true,
      admin: { description: 'The 32-character ID from Cloudflare Stream. Leave empty until the clip is uploaded.' },
      validate: (v: unknown) => !v || /^[a-f0-9]{32}$/.test(String(v)) || 'Paste the 32-character video ID from Cloudflare Stream',
    },
    { name: 'notes', type: 'textarea' },
  ],
}
