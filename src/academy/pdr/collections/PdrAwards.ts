import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { hasRole } from '../../../access'

/** A badge a player has earned (awarded automatically when they complete a level). */
export const PdrAwards: CollectionConfig = {
  slug: 'pdr-awards',
  labels: { singular: 'Badge earned', plural: 'Badges earned' },
  admin: { group: 'Foundation+', defaultColumns: ['player', 'badge', 'awardedAt'] },
  access: {
    read: ({ req: { user } }) => hasRole(user as never, 'admin', 'committee', 'coach'),
    create: ({ req: { user } }) => hasRole(user as never, 'admin'),
    update: ({ req: { user } }) => hasRole(user as never, 'admin'),
    delete: ({ req: { user } }) => hasRole(user as never, 'admin'),
  },
  defaultSort: '-awardedAt',
  hooks: {
    beforeValidate: [
      async ({ data, originalDoc, req, operation }) => {
        if (!data || operation !== 'create') return data
        const { totalDocs } = await req.payload.count({ collection: 'pdr-awards', where: { player: { equals: data.player }, badge: { equals: data.badge } }, overrideAccess: true, req })
        if (totalDocs && !originalDoc) throw new APIError('This player already has that badge.', 400, undefined, true)
        data.awardedAt = data.awardedAt ?? new Date().toISOString()
        return data
      },
    ],
  },
  fields: [
    { type: 'row', fields: [{ name: 'player', type: 'relationship', relationTo: 'participants', required: true, index: true }, { name: 'badge', type: 'relationship', relationTo: 'pdr-badges', required: true, index: true }] },
    { type: 'row', fields: [{ name: 'awardedAt', type: 'date' }, { name: 'celebratedAt', label: 'Celebration shown', type: 'date', admin: { readOnly: true } }] },
  ],
}
