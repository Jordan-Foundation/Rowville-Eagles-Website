'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { managementOrNull } from '@/lib/management'
import { saveFitout, sizesFor } from '@/numbers/fitout'

const back = (path: string, kind: 'done' | 'error', msg: string): never => redirect(`${path}?${kind}=${encodeURIComponent(msg)}`)

export async function createSession(fd: FormData) {
  const me = await managementOrNull()
  if (!me) back('/management/fitout', 'error', 'Management only.')
  const name = String(fd.get('name') ?? '').trim()
  const date = String(fd.get('date') ?? '')
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date)) back('/management/fitout', 'error', 'Give the session a name and a date.')
  const program = ['rfa', 'rowville'].includes(String(fd.get('program'))) ? (String(fd.get('program')) as 'rfa' | 'rowville') : 'both'
  const doc = await (await payload()).create({ collection: 'fitout-sessions', data: { name, date: `${date}T00:00:00.000Z`, program, createdBy: me!.id }, overrideAccess: true })
  redirect(`/management/fitout/${doc.id}`)
}

/** Pre-fill: this session's sizes for the player, or their last fitout's. */
export async function loadSizes(sessionId: number, participantId: number) {
  if (!(await managementOrNull())) return { sizes: {}, notes: '', existing: false }
  const r = await sizesFor(await payload(), sessionId, participantId)
  return { sizes: r.sizes, notes: r.notes, existing: Boolean(r.here), previous: !r.here && Object.keys(r.sizes).length > 0 }
}

export async function saveSizes(sessionId: number, participantId: number, sizes: Record<number, string>, notes: string) {
  const me = await managementOrNull()
  if (!me) return { error: 'Management only.' }
  await saveFitout(await payload(), { sessionId, participantId, sizes, notes, by: me.id })
  revalidatePath(`/management/fitout/${sessionId}`)
  return { ok: true }
}

/** Kit items & sizes (one size per line). */
export async function saveKitItems(fd: FormData) {
  const me = await managementOrNull()
  if (!me) back('/management/fitout/items', 'error', 'Management only.')
  const p = await payload()
  for (const id of fd.getAll('id').map(Number)) {
    const sizes = String(fd.get(`sizes-${id}`) ?? '').split('\n').map((s) => s.trim()).filter(Boolean)
    if (!sizes.length) back('/management/fitout/items', 'error', 'Each item needs at least one size.')
    await p.update({ collection: 'kit-items', id, data: { name: String(fd.get(`name-${id}`) ?? '').trim() || 'Item', sortOrder: Number(fd.get(`order-${id}`)) || 0, active: fd.get(`active-${id}`) === 'on', sizes: sizes.map((label) => ({ label })) }, overrideAccess: true })
  }
  const newName = String(fd.get('newName') ?? '').trim()
  if (newName) {
    const sizes = String(fd.get('newSizes') ?? '').split('\n').map((s) => s.trim()).filter(Boolean)
    if (!sizes.length) back('/management/fitout/items', 'error', `Add the sizes for ${newName} (one per line).`)
    await p.create({ collection: 'kit-items', data: { name: newName, sortOrder: 99, active: true, sizes: sizes.map((label) => ({ label })) }, overrideAccess: true })
  }
  revalidatePath('/management/fitout', 'layout')
  back('/management/fitout/items', 'done', 'Kit items saved.')
}
