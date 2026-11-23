'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { managementOrNull } from '@/lib/management'
import { applySessionLengths } from '@/academy/session-lengths'

const PATH = '/management/session-lengths'
const back = (kind: 'done' | 'error', msg: string): never => redirect(`${PATH}?${kind}=${encodeURIComponent(msg)}`)

/** Save the lengths, then apply them to upcoming sessions straight away. */
export async function saveLengths(fd: FormData) {
  if (!(await managementOrNull())) back('error', 'Management only.')
  const groups = fd.getAll('ageGroup').map((v) => String(v).trim().toUpperCase())
  const mins = fd.getAll('minutes').map((v) => Number(v))
  const rows: { ageGroup: string; minutes: number }[] = []
  groups.forEach((g, i) => {
    if (!g && !mins[i]) return
    if (!/^U\d{1,2}$/.test(g)) back('error', `“${g}” isn’t an age group — use U7, U8 …`)
    if (!(mins[i] >= 15 && mins[i] <= 240)) back('error', `${g}: minutes must be between 15 and 240.`)
    if (rows.some((r) => r.ageGroup === g)) back('error', `${g} is listed twice.`)
    rows.push({ ageGroup: g, minutes: mins[i] })
  })
  const p = await payload()
  await p.updateGlobal({ slug: 'academy-settings', overrideAccess: true, data: { sessionLengths: rows } })
  const r = await applySessionLengths(p)
  revalidatePath('/management', 'layout')
  back('done', `Saved. ${r.changed.length} time slot${r.changed.length === 1 ? '' : 's'} updated${r.skipped.length ? `, ${r.skipped.length} skipped (booked)` : ''}.`)
}

export async function applyNow() {
  if (!(await managementOrNull())) back('error', 'Management only.')
  const r = await applySessionLengths(await payload())
  revalidatePath('/management', 'layout')
  back('done', `${r.changed.length} time slot${r.changed.length === 1 ? '' : 's'} updated${r.skipped.length ? `, ${r.skipped.length} skipped (booked)` : ''}${r.trialNights ? `, ${r.trialNights} trial night${r.trialNights === 1 ? '' : 's'}` : ''}.`)
}
