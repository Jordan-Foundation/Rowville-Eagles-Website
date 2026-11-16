import type { CollectionConfig } from 'payload'
import { isStaff } from '../access'

/** Photos of coaches' Working With Children Check cards. Private: Management only (coaches upload through their sign-up page). */
export const WwccFiles: CollectionConfig = {
  slug: 'wwcc-files',
  labels: { singular: 'WWCC card', plural: 'WWCC cards' },
  admin: { group: 'People', hidden: true },
  access: { read: isStaff, create: isStaff, update: isStaff, delete: isStaff },
  upload: { mimeTypes: ['image/*', 'application/pdf'] },
  fields: [{ name: 'note', type: 'text' }],
}
