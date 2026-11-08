'use server'

import { revalidatePath } from 'next/cache'
import { managementOrNull } from '@/lib/management'
import { payload } from '@/lib/payload'
import { DATE_FIELDS, parseDateInput } from '@/lib/dates-edit'

export type DateRowState = { ok?: string; error?: string }
const COLLECTIONS = ['academy-terms', 'programs', 'trial-sessions', 'report-cycles', 'pdr-challenges', 'selection-rounds'] as const

/** Save one row. Only allow-listed fields are written; everything else in the form is ignored → rejected. */
export async function saveDateRow(_prev: DateRowState, fd: FormData): Promise<DateRowState> {
  const user = await managementOrNull()
  if (!user) return { error: 'Management only.' }
  const target = String(fd.get('$target') ?? '')
  const p = await payload()
  const data: Record<string, string | number | null> = {}
  const prefix = target.startsWith('g:') ? target : target.split(':')[0]
  try {
    for (const [name, raw] of fd.entries()) {
      if (name.startsWith('$') || typeof raw !== 'string') continue
      const kind = DATE_FIELDS[`${prefix}.${name}`]
      if (!kind) return { error: `“${name}” can’t be changed here.` }
      if (raw === String(fd.get(`$orig:${name}`) ?? '')) continue
      data[name] = parseDateInput(kind, raw)
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Check the dates.' }
  }
  if (!Object.keys(data).length) return { ok: 'No changes.' }
  try {
    if (target === 'g:site-settings') {
      await p.updateGlobal({ slug: 'site-settings', data: data as never, user, overrideAccess: false })
    } else {
      const [collection, idRaw] = target.split(':')
      const id = Number(idRaw)
      if (!(COLLECTIONS as readonly string[]).includes(collection) || !Number.isInteger(id)) return { error: 'Unknown item.' }
      if (collection === 'programs') {
        const prog = await p.findByID({ collection: 'programs', id, depth: 0, overrideAccess: true })
        if ((prog.type === 'academy-term' || prog.type === 'toddler') && prog.academyTerm) return { error: 'This program follows its Academy term — change the term’s dates.' }
      }
      await p.update({ collection: collection as 'programs', id, data: data as never, user, overrideAccess: false })
      // Group programs + Mini Ballers linked to the term take its new dates
      if (collection === 'academy-terms' && ('startDate' in data || 'endDate' in data)) {
        const { docs } = await p.find({ pagination: false, collection: 'programs', where: { academyTerm: { equals: id }, type: { in: ['academy-term', 'toddler'] } }, limit: 50, depth: 0, overrideAccess: true })
        for (const prog of docs) await p.update({ collection: 'programs', id: prog.id, data: { academyTerm: id }, overrideAccess: true })
      }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not save.' }
  }
  revalidatePath('/management/dates')
  return { ok: 'Saved.' }
}
