'use server'

import { revalidatePath } from 'next/cache'
import { managementOrNull } from '@/lib/management'
import { payload } from '@/lib/payload'
import { LEVELS, STRANDS } from '@/academy/curriculum/levels'

export type WordingState = { saved?: string; error?: string }

/** Parse "CODE  text" lines (code = first word). */
function parseDescriptors(raw: string) {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = /^(\S+)\s+[—–-]?\s*(.+)$/.exec(l)
      return m ? { code: m[1].slice(0, 30), text: m[2].slice(0, 1000) } : null
    })
}

/** Change the wording of one strand's standard for one level (what coaches rate against and families read). */
export async function saveWording(_prev: WordingState, fd: FormData): Promise<WordingState> {
  const user = await managementOrNull()
  if (!user) return { error: 'Management only — please log in again.' }
  const level = String(fd.get('level'))
  const strand = String(fd.get('strand'))
  if (!LEVELS.some((l) => l.key === level) || !STRANDS.some((s) => s.key === strand)) return { error: 'Unknown level or strand.' }
  const standard = String(fd.get('standard') ?? '').trim().slice(0, 2000)
  if (standard.length < 10) return { error: 'The achievement standard looks too short.' }
  const descriptors = parseDescriptors(String(fd.get('descriptors') ?? ''))
  if (descriptors.some((d) => !d)) return { error: 'Each descriptor line needs a code then the wording, e.g. “FF-9-ATT01 Dribbles past a defender…”.' }
  const p = await payload()
  const { docs } = await p.find({ pagination: false, collection: 'curriculum-standards', where: { level: { equals: level }, strand: { equals: strand } }, limit: 1, depth: 0, overrideAccess: true })
  const data = { standard, descriptors: descriptors as { code: string; text: string }[] }
  if (docs[0]) await p.update({ collection: 'curriculum-standards', id: docs[0].id, data, overrideAccess: true, user })
  else await p.create({ collection: 'curriculum-standards', data: { ...data, level: level as never, strand: strand as never }, overrideAccess: true, user })
  revalidatePath('/management/curriculum')
  return { saved: 'Saved — reports use the new wording from now on.' }
}
