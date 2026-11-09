import { payload } from '@/lib/payload'
import { icsFile, type CalEvent } from '@/lib/ics'
import { programPlace } from '@/lib/place'
import { siteBase } from '@/lib/seo'
import { slotSessions } from '@/academy/terms/slots'
import type { AcademyTermSlot, Program } from '@/payload-types'

export const dynamic = 'force-dynamic'

const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null))

/** "Add to calendar" for a booking (by its reference): camps, programs, group training times and 1-on-1s. */
export async function GET(_req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const ref = (await params).ref.replace(/\.ics$/, '').toUpperCase()
  if (!/^[A-Z]{2,4}-[A-Z0-9]{4,10}$/.test(ref)) return new Response('Not found', { status: 404 })
  const p = await payload()
  const settings = await p.findGlobal({ slug: 'site-settings', depth: 0 })
  const ground = settings.ground?.address ?? null
  const events: CalEvent[] = []
  const { docs: club } = await p.find({ pagination: false, collection: 'bookings', where: { reference: { equals: ref }, status: { equals: 'paid' } }, limit: 1, depth: 2, overrideAccess: true })
  if (club[0]) {
    const b = club[0]
    const prog = b.program as Program
    const where = programPlace(prog.location, ground).place
    const description = [prog.scheduleNote, prog.dropOffPickUp, prog.whatToBring && `What to bring: ${prog.whatToBring}`, `Booking ${ref}`].filter(Boolean).join('\n')
    const reg = b.academyRegistration && typeof b.academyRegistration === 'object' ? b.academyRegistration : null
    const slot = reg?.slot && typeof reg.slot === 'object' ? (reg.slot as AcademyTermSlot) : null
    if (slot) {
      for (const s of slotSessions(slot, prog).filter((x) => !x.cancelled)) events.push({ uid: `${ref}-${s.date}@rowvilleeagles`, title: prog.title, start: s.startsAt, end: s.endsAt, location: slot.venue || where, description })
    } else if (b.sessionStart) {
      events.push({ uid: `${ref}@rowvilleeagles`, title: prog.title, start: b.sessionStart, location: where, description })
    } else if (prog.startDate) {
      const sameDay = !prog.endDate || prog.endDate.slice(0, 10) === prog.startDate.slice(0, 10) || Date.parse(prog.endDate) - Date.parse(prog.startDate) < 20 * 3_600_000
      events.push({ uid: `${ref}@rowvilleeagles`, title: prog.title, start: prog.startDate, end: prog.endDate, allDay: !sameDay, location: where, description })
    }
  } else {
    const { docs } = await p.find({ pagination: false, collection: 'academy-bookings', where: { reference: { equals: ref }, status: { in: ['confirmed', 'completed'] } }, limit: 1, depth: 1, overrideAccess: true })
    const b = docs[0]
    if (!b) return new Response('Not found', { status: 404 })
    const coach = b.coach && typeof b.coach === 'object' ? b.coach.displayName : 'your coach'
    const { docs: sessions } = await p.find({ pagination: false, collection: 'academy-sessions', where: { booking: { equals: b.id }, status: { in: ['scheduled', 'completed'] } }, sort: 'startsAt', limit: 60, depth: 0, overrideAccess: true })
    const term = b.term && typeof b.term === 'object' ? b.term : null
    const mins = term?.sessionMinutes || 60
    for (const s of sessions) events.push({ uid: `${ref}-${s.id}@rowvilleeagles`, title: b.kind === 'group' ? `Small group with ${coach}` : `1-on-1 with ${coach}`, start: s.startsAt, end: new Date(Date.parse(s.startsAt) + mins * 60_000).toISOString(), location: term?.location || ground, description: `Foundation Academy · booking ${ref}` })
  }
  if (!events.length) return new Response('Not found', { status: 404 })
  for (const e of events) e.url = `${siteBase()}/account/bookings/${ref}`
  return new Response(icsFile(events), { headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': `attachment; filename="${ref}.ics"`, 'cache-control': 'private, max-age=300' } })
}
