import type { Payload } from 'payload'
import data from './curriculum-data.json'
import type { LevelKey, StrandKey } from './levels'

export type Standard = { level: LevelKey; strand: StrandKey; standard: string; descriptors: { code: string; text: string }[] }

/** All standards from the database (the imported curriculum, as edited in the admin). */
export async function curriculum(p: Payload) {
  const { docs } = await p.find({ collection: 'curriculum-standards', limit: 200, depth: 0, sort: 'order', overrideAccess: true })
  return docs.map((d) => ({ level: d.level, strand: d.strand, standard: d.standard, descriptors: (d.descriptors ?? []).map((x) => ({ code: x.code, text: x.text })) })) as Standard[]
}

export const standardFor = (all: Standard[], level: LevelKey, strand: StrandKey) => all.find((s) => s.level === level && s.strand === strand) ?? null

/** Load the curriculum document into the database (only rows that aren't there yet — admin edits are kept). */
export async function importCurriculum(p: Payload, req?: Parameters<Payload['create']>[0]['req']) {
  const src = data as Record<string, Record<string, { standard: string; descriptors: { code: string; text: string }[] }>>
  const { docs } = await p.find({ collection: 'curriculum-standards', limit: 200, depth: 0, overrideAccess: true, req, select: { level: true, strand: true } })
  const have = new Set(docs.map((d) => `${d.level}|${d.strand}`))
  let created = 0
  for (const [level, strands] of Object.entries(src)) {
    for (const [strand, v] of Object.entries(strands)) {
      if (have.has(`${level}|${strand}`)) continue
      await p.create({ collection: 'curriculum-standards', overrideAccess: true, req, data: { level: level as LevelKey, strand: strand as StrandKey, standard: v.standard, descriptors: v.descriptors } })
      created++
    }
  }
  return created
}
