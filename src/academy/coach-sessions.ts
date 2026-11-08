import type { Payload, Where } from 'payload'
import type { AcademyBooking, AcademyCoach, AcademySession, Participant } from '@/payload-types'
import { coachRole } from './session-view'

/**
 * What a coach sees about their 1-on-1s. A coach only ever sees sessions they run:
 * their own bookings, or sessions they've been assigned to cover.
 */

const rel = (v: number | { id: number } | null | undefined) => (v && typeof v === 'object' ? v.id : (v ?? null))

const mine = (coachId: number): Where => ({
  or: [{ coach: { equals: coachId } }, { coverCoach: { equals: coachId } }],
  status: { in: ['scheduled', 'completed', 'no_show'] },
})

export async function coachSessions(payload: Payload, coachId: number, range: { from: Date; to: Date }) {
  const { docs } = await payload.find({
    collection: 'academy-sessions',
    where: { ...mine(coachId), startsAt: { greater_than_equal: range.from.toISOString(), less_than: range.to.toISOString() } },
    sort: 'startsAt',
    depth: 1,
    limit: 500,
    overrideAccess: true,
  })
  return docs.map((s) => ({ session: s, booking: s.booking as AcademyBooking, role: coachRole(s, coachId)! }))
}

/** Sessions that have started but still have no attendance marked. */
export async function attendanceDue(payload: Payload, coachId: number, now = new Date()) {
  const { docs } = await payload.find({
    collection: 'academy-sessions',
    where: { ...mine(coachId), status: { equals: 'scheduled' }, startsAt: { less_than: now.toISOString(), greater_than: new Date(now.getTime() - 60 * 86_400_000).toISOString() } },
    sort: '-startsAt',
    depth: 1,
    limit: 100,
    overrideAccess: true,
  })
  return docs.map((s) => ({ session: s, booking: s.booking as AcademyBooking, role: coachRole(s, coachId)! })).filter((x) => x.role !== 'covered')
}

export type PlayerCard = {
  name: string
  firstName: string
  dateOfBirth: string
  currentClub?: string | null
  position?: string | null
  goals?: string | null
  medical?: string | null
  emergencyName?: string | null
  emergencyPhone?: string | null
  photoConsent: boolean
  parent: { name: string; email: string; mobile: string }
}

/** Latest details: the family's player record wins over what they typed at checkout. */
export function playerCard(b: AcademyBooking, kid: Participant | null): PlayerCard {
  return {
    name: `${kid?.firstName ?? b.player.firstName} ${kid?.lastName ?? b.player.lastName}`,
    firstName: kid?.firstName ?? b.player.firstName,
    dateOfBirth: kid?.dateOfBirth ?? b.player.dateOfBirth,
    currentClub: kid?.football?.currentClub || b.player.currentClub,
    position: kid?.football?.position || b.player.position,
    goals: kid?.football?.goals || b.player.goals,
    medical: kid?.medical?.conditions || b.player.medical,
    emergencyName: kid?.medical?.emergencyContact || b.player.emergencyName,
    emergencyPhone: kid?.medical?.emergencyPhone || b.player.emergencyPhone,
    photoConsent: Boolean(kid?.photoConsent ?? b.player.photoConsent),
    parent: { name: `${b.contact.firstName} ${b.contact.lastName}`, email: b.contact.email, mobile: b.contact.mobile },
  }
}

/** One session, only if this coach runs (or ran) it — with the player and their history with this coach. */
export async function loadCoachSession(payload: Payload, coachId: number, sessionId: number) {
  const session = await payload.findByID({ collection: 'academy-sessions', id: sessionId, depth: 1, overrideAccess: true, disableErrors: true })
  if (!session || session.status === 'held' || session.status === 'cancelled') return null
  const role = coachRole(session, coachId)
  if (!role) return null
  const booking = session.booking as AcademyBooking
  const kid = booking.participant ? await payload.findByID({ collection: 'participants', id: rel(booking.participant)!, depth: 0, overrideAccess: true, disableErrors: true }) : null

  // This player's other sessions with this coach (all their bookings, so a casual then a term both show)
  const { docs: bookings } = await payload.find({
    collection: 'academy-bookings',
    where: kid ? { participant: { equals: kid.id } } : { id: { equals: booking.id } },
    depth: 0,
    limit: 100,
    overrideAccess: true,
    select: { reference: true },
  })
  const { docs: history } = await payload.find({
    collection: 'academy-sessions',
    where: { ...mine(coachId), booking: { in: bookings.map((b) => b.id) } },
    sort: 'startsAt',
    depth: 0,
    limit: 200,
    overrideAccess: true,
  })
  const inBooking = history.filter((h) => rel(h.booking) === booking.id)
  const { totalDocs: bookingSessions } = await payload.count({ collection: 'academy-sessions', where: { booking: { equals: booking.id }, status: { not_equals: 'cancelled' } }, overrideAccess: true })
  const { docs: ordered } = await payload.find({ pagination: false, collection: 'academy-sessions', where: { booking: { equals: booking.id }, status: { not_equals: 'cancelled' } }, sort: 'startsAt', depth: 0, limit: 60, overrideAccess: true, select: { startsAt: true } })
  return {
    session,
    booking,
    role,
    player: playerCard(booking, kid),
    bookedCoach: session.coach as AcademyCoach,
    coverCoach: session.coverCoach && typeof session.coverCoach === 'object' ? (session.coverCoach as AcademyCoach) : null,
    sessionNumber: ordered.findIndex((x) => x.id === session.id) + 1,
    bookingSessions,
    history: history.filter((h) => h.id !== session.id && h.status !== 'held') as AcademySession[],
    inBookingCount: inBooking.length,
  }
}
