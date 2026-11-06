'use server'

import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { coachOrNull } from '@/academy/portal'
import { WEEKDAYS, type Weekday } from '@/academy/constants'

export type AvailabilityState = { error?: string; saved?: boolean; first?: boolean }

const key = (s: { weekday: string; startTime: string }) => `${s.weekday} ${s.startTime}`

export async function saveAvailability(_prev: AvailabilityState, fd: FormData): Promise<AvailabilityState> {
  const me = await coachOrNull()
  if (!me) return { error: 'Please log in as a coach.' }
  const p = await payload()
  const termId = Number(fd.get('termId'))
  const term = termId ? await p.findByID({ collection: 'academy-terms', id: termId, depth: 0, disableErrors: true }) : null
  if (!term || !['availability', 'open'].includes(term.status)) return { error: 'This term isn’t taking availability any more. Contact the admin to make changes.' }

  let picked: { weekday: Weekday; startTime: string }[]
  try {
    const allowedTimes = new Set((term.slotStartTimes ?? []).map((t) => t.time))
    picked = (JSON.parse(String(fd.get('slots') ?? '[]')) as string[]).map((k) => {
      const [weekday, startTime] = k.split(' ')
      if (!(WEEKDAYS as readonly string[]).includes(weekday) || !allowedTimes.has(startTime)) throw new Error(k)
      return { weekday: weekday as Weekday, startTime }
    })
  } catch {
    return { error: 'Some of those times aren’t available for this term. Please refresh and try again.' }
  }
  const unique = Array.from(new Map(picked.map((s) => [key(s), s])).values())

  const { docs } = await p.find({ collection: 'academy-availability', where: { coach: { equals: me.coach.id }, term: { equals: term.id } }, limit: 1, depth: 0, overrideAccess: true })
  const existing = docs[0]
  const before = new Set((existing?.slots ?? []).map(key))
  const after = new Set(unique.map(key))
  const added = [...after].filter((k) => !before.has(k))
  const removed = [...before].filter((k) => !after.has(k))
  // Stage 5 will block removing slots that already have bookings; there are no 1-on-1 bookings yet.

  const now = new Date().toISOString()
  const change = added.length || removed.length ? [{ at: now, added: added.join(', ') || undefined, removed: removed.join(', ') || undefined }] : []
  const sorted = unique.sort((a, b) => WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday) || a.startTime.localeCompare(b.startTime))

  if (existing) {
    await p.update({
      collection: 'academy-availability',
      id: existing.id,
      overrideAccess: true,
      data: { slots: sorted, submittedAt: existing.submittedAt ?? now, changes: [...(existing.changes ?? []), ...change] },
    })
  } else {
    await p.create({ collection: 'academy-availability', overrideAccess: true, data: { coach: me.coach.id, term: term.id, slots: sorted, submittedAt: now, changes: change } })
  }
  revalidatePath('/coach')
  return { saved: true, first: !existing?.submittedAt }
}
