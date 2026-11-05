import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { isStaff } from '../access'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Image', plural: 'Images' },
  admin: {
    group: 'Club',
    description: 'Photos and logos. JPG or WebP is best for photos; PNG for logos. Large photos are fine — they upload directly to storage.',
  },
  access: {
    read: () => true,
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  hooks: {
    beforeOperation: [
      ({ operation }) => {
        // On Vercel the server disk is read-only: uploads only work once Vercel Blob storage is connected.
        if ((operation === 'create' || operation === 'update') && process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN) {
          throw new APIError(
            'Image storage isn’t connected. In Vercel: Storage → Create → Blob → connect it to this project, then redeploy.',
            500,
            undefined,
            true,
          )
        }
      },
    ],
  },
  fields: [
    {
      name: 'alt',
      label: 'Alt text',
      type: 'text',
      required: true,
      admin: { description: 'Short description of the image for screen readers and Google, e.g. "U9 players at the January holiday camp".' },
    },
  ],
  upload: {
    mimeTypes: ['image/*'],
  },
}
