'use server'

import { revalidatePath } from 'next/cache'
import { managementOrNull } from '@/lib/management'
import { payload } from '@/lib/payload'

export type ProgramEditState = { saved?: string; error?: string }

const s = (fd: FormData, k: string, max = 300) => String(fd.get(k) ?? '').trim().slice(0, max)
const n = (fd: FormData, k: string) => (s(fd, k) === '' ? null : Number(s(fd, k)))
const STATUSES = ['draft', 'open', 'full', 'closed']

/** Program setup from Management (prices and dates have their own pages). */
export async function saveProgram(_prev: ProgramEditState, fd: FormData): Promise<ProgramEditState> {
  const user = await managementOrNull()
  if (!user) return { error: 'Management only — please log in again.' }
  const p = await payload()
  const prog = await p.findByID({ collection: 'programs', id: Number(fd.get('id')), depth: 0, overrideAccess: true, disableErrors: true })
  if (!prog) return { error: 'Program not found.' }
  const title = s(fd, 'title', 120)
  if (title.length < 3) return { error: 'Please give it a name.' }
  const status = s(fd, 'status')
  const [cap, minAge, maxAge] = [n(fd, 'capacity'), n(fd, 'minAge'), n(fd, 'maxAge')]
  for (const [v, label] of [[cap, 'Places'], [minAge, 'Min age'], [maxAge, 'Max age']] as const) if (v !== null && (!Number.isInteger(v) || v < 0 || v > 500)) return { error: `${label} must be a whole number.` }
  if (minAge !== null && maxAge !== null && minAge > maxAge) return { error: 'Min age is above max age.' }
  try {
    await p.update({
      collection: 'programs',
      id: prog.id,
      overrideAccess: true,
      user,
      data: {
        title,
        ...(STATUSES.includes(status) ? { status: status as 'open' } : {}),
        summary: s(fd, 'summary', 400) || prog.summary || undefined,
        location: s(fd, 'location', 200) || null,
        scheduleNote: s(fd, 'scheduleNote', 200) || null,
        ageRange: s(fd, 'ageRange', 60) || null,
        minAge,
        maxAge,
        capacity: cap,
        whatToBring: s(fd, 'whatToBring', 1000) || null,
        dropOffPickUp: s(fd, 'dropOffPickUp', 1000) || null,
        priceNote: s(fd, 'priceNote', 300) || null,
      },
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Couldn’t save.' }
  }
  revalidatePath(`/programs/${prog.slug}`)
  revalidatePath('/management/programs/setup')
  return { saved: 'Saved — the program page shows the changes now.' }
}
