import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { isStaff } from '../../../access'
import { levelTitle, PLACEHOLDER } from '../content'

/** A level of an area. Adding "Level 4" here (plus its stages) extends the program — no code changes. */
export const PdrLevels: CollectionConfig = {
  slug: 'pdr-levels',
  labels: { singular: 'Level', plural: 'Levels' },
  admin: { group: 'Player Development', useAsTitle: 'displayName', defaultColumns: ['displayName', 'area', 'number'] },
  access: { read: () => true, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: 'number',
  hooks: {
    beforeValidate: [
      async ({ data, originalDoc, req }) => {
        if (!data) return data
        const areaId = data.area ?? originalDoc?.area
        const number = data.number ?? originalDoc?.number
        if (!areaId || !number) return data
        const area = await req.payload.findByID({ collection: 'pdr-areas', id: typeof areaId === 'object' ? areaId.id : areaId, depth: 0, req, overrideAccess: true })
        const { docs } = await req.payload.find({ collection: 'pdr-levels', where: { area: { equals: area.id }, number: { equals: number } }, limit: 2, depth: 0, req, overrideAccess: true })
        if (docs.some((d) => d.id !== originalDoc?.id)) throw new APIError(`${area.name} already has a Level ${number}.`, 400, undefined, true)
        data.displayName = levelTitle(area.name, number)
        return data
      },
    ],
    afterChange: [
      // Every level gets its own badge (a placeholder until it's named in the admin)
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return doc
        const { totalDocs } = await req.payload.count({ collection: 'pdr-badges', where: { level: { equals: doc.id } }, req, overrideAccess: true })
        if (!totalDocs) {
          await req.payload.create({
            collection: 'pdr-badges',
            req,
            overrideAccess: true,
            data: { type: 'level', level: doc.id, area: doc.area, name: `${PLACEHOLDER} — ${doc.displayName}`, placeholder: true, howToEarn: `Pass all stages of ${doc.displayName}.` },
          })
        }
        return doc
      },
    ],
  },
  fields: [
    { name: 'displayName', type: 'text', admin: { hidden: true } },
    { type: 'row', fields: [{ name: 'area', type: 'relationship', relationTo: 'pdr-areas', required: true, index: true }, { name: 'number', label: 'Level number', type: 'number', required: true, min: 1, index: true }] },
    { name: 'title', type: 'text', admin: { description: 'Optional, e.g. “Foundations”' } },
    { name: 'description', type: 'textarea' },
  ],
}
