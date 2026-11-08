import type { CollectionConfig } from 'payload'
import { isStaff } from '../../../access'
import { LEVELS, STRANDS, levelName, strandName } from '../levels'

/**
 * Foundation Football Curriculum: for each level and strand, the achievement standard (what reports are judged
 * against) and the coded content descriptors (what coaches teach). Imported from the curriculum document; edit here.
 */
export const CurriculumStandards: CollectionConfig = {
  slug: 'curriculum-standards',
  labels: { singular: 'Curriculum standard', plural: 'Curriculum' },
  admin: { group: 'Curriculum', useAsTitle: 'label', defaultColumns: ['label', 'level', 'strand', 'updatedAt'], listSearchableFields: ['label', 'standard'], pagination: { defaultLimit: 50 } },
  access: { read: () => true, create: isStaff, update: isStaff, delete: isStaff },
  defaultSort: 'order',
  indexes: [{ fields: ['level', 'strand'], unique: true }],
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data.level && data.strand) {
          data.label = `${levelName(data.level)} · ${strandName(data.strand)}`
          data.order = LEVELS.findIndex((l) => l.key === data.level) * 10 + STRANDS.findIndex((s) => s.key === data.strand)
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'label', type: 'text', admin: { readOnly: true } },
    { name: 'order', type: 'number', admin: { hidden: true } },
    { type: 'row', fields: [
      { name: 'level', type: 'select', required: true, options: LEVELS.map((l) => ({ label: l.long, value: l.key })) },
      { name: 'strand', type: 'select', required: true, options: STRANDS.map((s) => ({ label: s.name, value: s.key })) },
    ] },
    { name: 'standard', label: 'Achievement standard', type: 'textarea', required: true, admin: { description: '“By the end of …, players …” — coaches rate each player against this.' } },
    {
      name: 'descriptors',
      label: 'Content descriptors',
      type: 'array',
      admin: { description: 'What coaches teach at this level, e.g. FF-9-ATT01.' },
      fields: [{ type: 'row', fields: [{ name: 'code', type: 'text', required: true, admin: { width: '25%' } }, { name: 'text', type: 'textarea', required: true }] }],
    },
  ],
}
