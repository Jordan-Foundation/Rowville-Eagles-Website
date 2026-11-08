import type { Payload } from 'payload'
import type { Program } from '@/payload-types'
import { formatDate } from '../../lib/format'
import { slotTaken } from './service'
import { slotSessions } from './slots'
import { trialPlacesLeft } from './toddler'

export type ToddlerTrialSession = { start: string; label: string; slot: number; left: number }

/** Every upcoming Mini Ballers session with its free-trial places left (2 per session, within the capacity of 10). */
export async function toddlerTrialSessions(p: Payload, program: Program): Promise<ToddlerTrialSession[]> {
  const tomorrow = Date.now() + 24 * 3_600_000
  const holdCutoff = new Date(Date.now() - 35 * 60_000).toISOString()
  const [{ docs: slots }, taken, { docs: trials }] = await Promise.all([
    p.find({ collection: 'academy-term-slots', where: { program: { equals: program.id }, active: { not_equals: false } }, limit: 50, depth: 0, overrideAccess: true }),
    slotTaken(p, program.id),
    p.find({
      collection: 'bookings',
      where: { program: { equals: program.id }, bookingType: { equals: 'trial' }, or: [{ status: { equals: 'paid' } }, { and: [{ status: { equals: 'pending' } }, { createdAt: { greater_than: holdCutoff } }] }] },
      limit: 2000,
      depth: 0,
      overrideAccess: true,
      select: { sessionStart: true },
    }),
  ])
  const trialsAt = new Map<string, number>()
  for (const t of trials) if (t.sessionStart) trialsAt.set(new Date(t.sessionStart).toISOString(), (trialsAt.get(new Date(t.sessionStart).toISOString()) ?? 0) + 1)
  const out: ToddlerTrialSession[] = []
  for (const s of slots) {
    for (const ses of slotSessions(s, program)) {
      if (ses.cancelled || new Date(ses.startsAt).getTime() < tomorrow) continue
      const start = new Date(ses.startsAt).toISOString()
      out.push({
        start,
        slot: s.id,
        label: formatDate(start, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }),
        left: trialPlacesLeft({ trialPlaces: program.trialPlacesPerNight ?? 2, trialsBooked: trialsAt.get(start) ?? 0, capacity: s.capacity ?? null, enrolled: taken.get(s.id) ?? 0 }),
      })
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start))
}
