'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { managementOrNull } from '@/lib/management'
import { TIME_RE } from '@/academy/hours'
import { localToUtc } from '@/lib/time'

const PATH = '/management/booking-hours'
const back = (kind: 'done' | 'error', msg: string): never => redirect(`${PATH}?${kind}=${encodeURIComponent(msg)}`)
const WINDOWS = [
  ['termWeekday', 'School term Mon–Fri'],
  ['termWeekend', 'School term Sat & Sun'],
  ['holiday', 'School holidays'],
] as const

/** Save the default booking hours, closed dates and back-to-back settings. */
export async function saveBookingHours(fd: FormData) {
  const me = await managementOrNull()
  if (!me) back('error', 'Management only.')
  const s = (k: string) => String(fd.get(k) ?? '').trim()
  const bookingHours: Record<string, string> = {}
  for (const [k, label] of WINDOWS) {
    const from = s(`${k}From`)
    const to = s(`${k}To`)
    if (!TIME_RE.test(from) || !TIME_RE.test(to)) back('error', `${label}: use 24-hour times, e.g. 16:00.`)
    if (to <= from) back('error', `${label}: the finish time must be after the start time.`)
    bookingHours[`${k}From`] = from
    bookingHours[`${k}To`] = to
  }
  const dates = fd.getAll('closedDate').map(String)
  const notes = fd.getAll('closedNote').map(String)
  const closed = dates
    .map((d, i) => ({ d: d.trim(), note: (notes[i] ?? '').trim().slice(0, 80) }))
    .filter((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.d))
    .sort((a, b) => a.d.localeCompare(b.d))
  const appliesTo = fd.getAll('appliesTo').map(String).filter((x) => ['casual', 'term', 'pack'].includes(x)) as ('casual' | 'term' | 'pack')[]
  const releaseHours = Math.max(0, Math.min(336, Math.round(Number(s('releaseHours')) || 0)))
  const p = await payload()
  await p.updateGlobal({
    slug: 'academy-settings',
    overrideAccess: true,
    data: {
      bookingHours,
      closedDates: [...new Map(closed.map((c) => [c.d, c])).values()].map((c) => ({ date: localToUtc(c.d, '00:00').toISOString(), note: c.note || undefined })),
      backToBack: { enabled: fd.get('enabled') === 'on', appliesTo, releaseHours },
    },
  })
  // Per-coach switch
  const off = new Set(fd.getAll('coachOff').map(Number))
  const { docs: coaches } = await p.find({ collection: 'academy-coaches', pagination: false, limit: 200, depth: 0, overrideAccess: true, select: { backToBack: true } })
  for (const c of coaches) {
    const want = !off.has(c.id)
    if ((c.backToBack !== false) !== want) await p.update({ collection: 'academy-coaches', id: c.id, data: { backToBack: want }, overrideAccess: true })
  }
  revalidatePath('/academy/1-on-1', 'layout')
  back('done', 'Booking hours saved.')
}
