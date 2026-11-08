import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { isStaff } from '../../../access'
import { criteriaProblem, stageCode } from '../content'

/** One stage = one skill: technique, challenge, pass criteria, tutorial + demo videos. */
export const PdrStages: CollectionConfig = {
  slug: 'pdr-stages',
  labels: { singular: 'Stage', plural: 'Stages' },
  admin: {
    group: 'Foundation+',
    useAsTitle: 'title',
    defaultColumns: ['code', 'skillName', 'scoring', 'placeholder', 'published'],
    listSearchableFields: ['code', 'skillName'],
  },
  access: {
    // Families see published stages; staff see everything
    read: ({ req: { user } }) => (user && 'roles' in user && (user.roles as string[]).some((r) => r === 'admin' || r === 'committee' || r === 'coach') ? true : { published: { equals: true } }),
    create: isStaff,
    update: isStaff,
    delete: isStaff,
  },
  defaultSort: 'sortKey',
  hooks: {
    beforeValidate: [
      async ({ data, originalDoc, req }) => {
        if (!data) return data
        const levelId = data.level ?? originalDoc?.level
        const n = data.stageNumber ?? originalDoc?.stageNumber
        if (!levelId || !n) return data
        const level = await req.payload.findByID({ collection: 'pdr-levels', id: typeof levelId === 'object' ? levelId.id : levelId, depth: 1, req, overrideAccess: true })
        const area = level.area as { id: number; name: string; order?: number | null }
        const { docs } = await req.payload.find({ pagination: false, collection: 'pdr-stages', where: { level: { equals: level.id }, stageNumber: { equals: n } }, limit: 2, depth: 0, req, overrideAccess: true })
        if (docs.some((d) => d.id !== originalDoc?.id)) throw new APIError(`${level.displayName} already has stage ${n}.`, 400, undefined, true)
        const scoring = data.scoring ?? originalDoc?.scoring
        const problem = criteriaProblem(scoring, { ...originalDoc?.criteria, ...data.criteria })
        if (problem && (data.published ?? originalDoc?.published)) throw new APIError(problem, 400, undefined, true)
        data.area = area.id
        data.levelNumber = level.number
        data.code = stageCode(area.name, level.number, n)
        data.title = `${data.code} — ${data.skillName ?? originalDoc?.skillName ?? ''}`
        data.sortKey = `${String(area.order ?? 0).padStart(3, '0')}-${String(level.number).padStart(3, '0')}-${String(n).padStart(3, '0')}`
        return data
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', admin: { hidden: true } },
    { name: 'sortKey', type: 'text', index: true, admin: { hidden: true } },
    {
      type: 'row',
      fields: [
        { name: 'level', type: 'relationship', relationTo: 'pdr-levels', required: true, index: true },
        { name: 'stageNumber', label: 'Stage', type: 'number', required: true, min: 1, admin: { description: '1–4' } },
        { name: 'code', type: 'text', index: true, admin: { readOnly: true, description: 'Set automatically, e.g. Passing 1.1' } },
      ],
    },
    { type: 'row', fields: [{ name: 'area', type: 'relationship', relationTo: 'pdr-areas', index: true, admin: { readOnly: true } }, { name: 'levelNumber', type: 'number', index: true, admin: { readOnly: true } }] },
    { name: 'skillName', label: 'Skill name', type: 'text', required: true, admin: { description: 'e.g. Inside-foot pass – preferred foot' } },
    { name: 'technique', label: 'Technique', type: 'textarea', admin: { description: 'How to perform the skill correctly' } },
    { name: 'challenge', label: 'Challenge', type: 'textarea', admin: { description: 'What the player must do to pass this stage' } },
    {
      name: 'scoring',
      type: 'radio',
      defaultValue: 'scored',
      options: [
        { label: 'Scored (target, leaderboards and rankings)', value: 'scored' },
        { label: 'Judged by a coach (creative — no leaderboard)', value: 'judged' },
      ],
    },
    {
      name: 'criteria',
      label: 'Pass criteria',
      type: 'group',
      admin: { condition: (_, s) => s?.scoring !== 'judged' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'target', type: 'number', min: 0 },
            { name: 'unit', type: 'text', admin: { description: 'e.g. passes, seconds, metres, touches' } },
            {
              name: 'direction',
              label: 'Better score',
              type: 'select',
              defaultValue: 'higher',
              options: [
                { label: 'Higher is better', value: 'higher' },
                { label: 'Lower is better (e.g. time)', value: 'lower' },
              ],
            },
          ],
        },
        { type: 'row', fields: [{ name: 'timeLimitSec', label: 'Time limit (seconds)', type: 'number', min: 0 }, { name: 'distanceM', label: 'Distance (metres)', type: 'number', min: 0 }] },
      ],
    },
    { type: 'row', fields: [{ name: 'tutorialVideo', type: 'relationship', relationTo: 'pdr-videos' }, { name: 'demoVideo', label: 'Demonstration video', type: 'relationship', relationTo: 'pdr-videos' }] },
    { name: 'coachingPoints', type: 'array', fields: [{ name: 'point', type: 'text', required: true }] },
    {
      type: 'row',
      fields: [
        { name: 'placeholder', type: 'checkbox', defaultValue: false, admin: { description: 'Content still to be written' } },
        { name: 'published', label: 'Visible to players', type: 'checkbox', defaultValue: false },
      ],
    },
  ],
}
