import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { hasRole } from '../../../access'

/** A player's pass of one stage: verified from a video, or promoted by a coach who saw it in person. */
export const PdrProgress: CollectionConfig = {
  slug: 'pdr-progress',
  labels: { singular: 'Stage passed', plural: 'Stages passed' },
  admin: { group: 'Foundation+', useAsTitle: 'label', defaultColumns: ['label', 'method', 'score', 'passedAt'] },
  access: {
    read: ({ req: { user } }) => hasRole(user as never, 'admin', 'committee', 'coach'),
    create: ({ req: { user } }) => hasRole(user as never, 'admin'),
    update: ({ req: { user } }) => hasRole(user as never, 'admin'),
    delete: ({ req: { user } }) => hasRole(user as never, 'admin'),
  },
  defaultSort: '-passedAt',
  hooks: {
    afterChange: [
      // Completing a level earns its badge (whether verified, promoted or added in the admin)
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return doc
        try {
          const { awardLevelBadge } = await import('../badges')
          await awardLevelBadge(req.payload, typeof doc.player === 'object' ? doc.player.id : doc.player, typeof doc.area === 'object' ? doc.area.id : doc.area, doc.levelNumber, req)
        } catch (e) {
          req.payload.logger.error({ err: e, msg: 'Awarding a badge failed' })
        }
        return doc
      },
    ],
    beforeValidate: [
      async ({ data, originalDoc, req }) => {
        if (!data) return data
        const player = data.player ?? originalDoc?.player
        const stageId = data.stage ?? originalDoc?.stage
        if (!player || !stageId) return data
        const sid = typeof stageId === 'object' ? stageId.id : stageId
        const pid = typeof player === 'object' ? player.id : player
        const { docs } = await req.payload.find({ collection: 'pdr-progress', where: { player: { equals: pid }, stage: { equals: sid } }, limit: 2, depth: 0, req, overrideAccess: true })
        if (docs.some((d) => d.id !== originalDoc?.id)) throw new APIError('This player has already passed that stage.', 400, undefined, true)
        const [stage, kid] = await Promise.all([
          req.payload.findByID({ collection: 'pdr-stages', id: sid, depth: 0, req, overrideAccess: true }),
          req.payload.findByID({ collection: 'participants', id: pid, depth: 0, req, overrideAccess: true }),
        ])
        data.area = stage.area
        data.levelNumber = stage.levelNumber
        data.label = `${kid.firstName} ${kid.lastName} — ${stage.code}`
        data.passedAt = data.passedAt ?? originalDoc?.passedAt ?? new Date().toISOString()
        return data
      },
    ],
  },
  fields: [
    { name: 'label', type: 'text', admin: { hidden: true } },
    { type: 'row', fields: [{ name: 'player', type: 'relationship', relationTo: 'participants', required: true, index: true }, { name: 'stage', type: 'relationship', relationTo: 'pdr-stages', required: true, index: true }] },
    { type: 'row', fields: [{ name: 'area', type: 'relationship', relationTo: 'pdr-areas', index: true, admin: { readOnly: true } }, { name: 'levelNumber', type: 'number', admin: { readOnly: true } }] },
    {
      type: 'row',
      fields: [
        { name: 'method', type: 'select', required: true, defaultValue: 'verified', options: [{ label: 'Verified from video', value: 'verified' }, { label: 'Promoted by a coach', value: 'promoted' }] },
        { name: 'score', label: 'Best verified score', type: 'number', admin: { description: 'From videos checked by a coach — used for leaderboards and rankings' } },
        { name: 'promotedScore', label: 'Score seen by the coach', type: 'number', admin: { description: 'Promotions only — shown on the report, never on leaderboards' } },
        { name: 'passedAt', type: 'date' },
      ],
    },
    { type: 'row', fields: [{ name: 'by', label: 'Coach', type: 'relationship', relationTo: 'users' }, { name: 'note', type: 'text' }] },
  ],
}
