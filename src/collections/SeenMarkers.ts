import type { CollectionConfig } from 'payload'

/** When someone last opened a section ("new since your last visit" badges). One row per person + section. */
export const SeenMarkers: CollectionConfig = {
  slug: 'seen-markers',
  admin: { hidden: true },
  access: { read: () => false, create: () => false, update: () => false, delete: () => false },
  indexes: [{ fields: ['user', 'key'], unique: true }],
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'key', type: 'text', required: true },
    { name: 'at', type: 'date', required: true },
  ],
}
