import type { Payload } from 'payload'
import type { AcademyCoach, User } from '@/payload-types'
import { attendanceDue } from '../academy/coach-sessions'
import { unreadCount } from '../messaging/service'
import { seenAt } from './seen'
import { outstandingFor } from '../academy/reports/service'

/**
 * "Needs attention" counts for the dashboard badges. Every count is a cheap database count, worked out on
 * the server for the signed-in person (refreshed on page load and about once a minute).
 */
const q = { overrideAccess: true } as const
const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number))
const safe = async (f: () => Promise<number>) => {
  try {
    return await f()
  } catch {
    return 0
  }
}

/** Terms where availability is due and still open. */
async function termsAwaitingAvailability(p: Payload) {
  const now = new Date().toISOString()
  const { docs } = await p.find({ collection: 'academy-terms', where: { status: { in: ['availability', 'open'] }, availabilityDeadline: { greater_than: now } }, limit: 10, depth: 0, ...q })
  return docs
}

/** New Team Chat posts by others, per team, since the person last opened that team's page. */
export async function teamChatNew(p: Payload, user: User, teamIds: number[]) {
  if (!teamIds.length) return {} as Record<number, number>
  const seen = await seenAt(p, user.id, teamIds.map((t) => `team:${t}`))
  const out: Record<number, number> = {}
  for (const t of teamIds) {
    const since = seen[`team:${t}`]
    const { docs: threads } = await p.find({ collection: 'forum-threads', where: { team: { equals: t }, removedAt: { exists: false } }, limit: 500, depth: 0, ...q, select: { author: true, createdAt: true } })
    const newThreads = threads.filter((x) => x.createdAt > since && rel(x.author) !== user.id).length
    const replies = threads.length
      ? (await p.count({ collection: 'forum-replies', where: { thread: { in: threads.map((x) => x.id) }, removedAt: { exists: false }, createdAt: { greater_than: since }, author: { not_equals: user.id } }, ...q })).totalDocs
      : 0
    out[t] = newThreads + replies
  }
  return out
}

export async function coachTeams(p: Payload, user: User) {
  const { docs } = await p.find({ collection: 'teams', where: { coaches: { in: [user.id] }, archived: { not_equals: true } }, limit: 50, depth: 0, ...q, select: { name: true, slug: true, type: true } })
  return docs
}

export type CoachCounts = Record<'messages' | 'sessions' | 'attendance' | 'availability' | 'groups' | 'teams' | 'reviews' | 'reports', number>

export async function coachAttention(p: Payload, user: User, coach: AcademyCoach): Promise<CoachCounts> {
  const seen = await seenAt(p, user.id, ['sessions', 'groups'])
  const [messages, sessions, attendance, availability, groups, teams, reviews] = await Promise.all([
    safe(() => unreadCount(p, { user, side: 'coach', coach })),
    // New 1-on-1 sessions booked with this coach since they last opened My sessions
    safe(async () => (await p.count({ collection: 'academy-sessions', where: { coach: { equals: coach.id }, status: { equals: 'scheduled' }, createdAt: { greater_than: seen.sessions }, startsAt: { greater_than: new Date().toISOString() } }, ...q })).totalDocs),
    safe(async () => (await attendanceDue(p, coach.id)).length),
    safe(async () => {
      const terms = await termsAwaitingAvailability(p)
      if (!terms.length) return 0
      const { docs } = await p.find({ collection: 'academy-availability', where: { coach: { equals: coach.id }, term: { in: terms.map((t) => t.id) }, submittedAt: { exists: true } }, limit: 20, depth: 0, ...q })
      return terms.length - docs.length
    }),
    // Training times / groups this coach was put on (or that changed) since they last opened My groups
    safe(async () => (await p.count({ collection: 'academy-term-slots', where: { or: [{ coaches: { contains: coach.id } }, { 'groups.coaches': { contains: coach.id } }], updatedAt: { greater_than: seen.groups } }, ...q })).totalDocs),
    safe(async () => Object.values(await teamChatNew(p, user, (await coachTeams(p, user)).map((t) => t.id))).reduce((a, b) => a + b, 0)),
    safe(async () => (await p.count({ collection: 'pdr-submissions', where: { status: { equals: 'pending' } }, ...q })).totalDocs),
  ])
  const reports = await safe(() => outstandingFor(p, user.id))
  return { messages, sessions, attendance, availability, groups, teams, reviews, reports }
}

export type ManagementCounts = Record<'bookings' | 'payments' | 'cover' | 'availability' | 'terms' | 'selections' | 'messages' | 'store' | 'foundation' | 'consent' | 'reports', number>

export async function managementAttention(p: Payload, user: User): Promise<ManagementCounts> {
  const now = new Date().toISOString()
  const seen = await seenAt(p, user.id, ['bookings'])
  const [bookings, payments, cover, availability, terms, selections, messages, store, foundation, consent] = await Promise.all([
    // Families' cancellations since last visit + paid-after-expiry bookings that need a refund
    safe(async () => {
      const [c, r] = await Promise.all([
        p.count({ collection: 'academy-sessions', where: { status: { equals: 'cancelled' }, cancelledBy: { equals: 'family' }, cancelledAt: { greater_than: seen.bookings } }, ...q }),
        p.count({ collection: 'academy-bookings', where: { status: { equals: 'payment_failed' }, paymentMode: { not_equals: 'weekly' } }, ...q }),
      ])
      return c.totalDocs + r.totalDocs
    }),
    safe(async () => (await p.count({ collection: 'academy-bookings', where: { paymentMode: { equals: 'weekly' }, status: { equals: 'payment_failed' } }, ...q })).totalDocs),
    safe(async () => (await p.count({ collection: 'academy-sessions', where: { needsCover: { equals: true }, coverCoach: { exists: false }, status: { in: ['held', 'scheduled'] }, startsAt: { greater_than: now } }, ...q })).totalDocs),
    // Coaches who haven't submitted availability for a term that's still collecting it
    safe(async () => {
      const termsDue = await termsAwaitingAvailability(p)
      if (!termsDue.length) return 0
      const [coaches, submitted] = await Promise.all([
        p.count({ collection: 'users', where: { roles: { contains: 'coach' } }, ...q }),
        p.count({ collection: 'academy-availability', where: { term: { in: termsDue.map((t) => t.id) }, submittedAt: { exists: true } }, ...q }),
      ])
      return Math.max(0, coaches.totalDocs * termsDue.length - submitted.totalDocs)
    }),
    // Academy terms: families waiting for a place + training times/groups with no coach
    safe(async () => {
      const { docs: programs } = await p.find({ collection: 'programs', where: { type: { in: ['academy-term', 'toddler'] }, status: { in: ['open', 'full'] } }, limit: 30, depth: 0, ...q, select: { title: true } })
      if (!programs.length) return 0
      const ids = programs.map((x) => x.id)
      const [waiting, slots] = await Promise.all([
        p.count({ collection: 'academy-registrations', where: { program: { in: ids }, or: [{ status: { equals: 'interest' } }, { and: [{ status: { equals: 'offered' } }, { slot: { exists: false } }] }] }, ...q }),
        p.find({ collection: 'academy-term-slots', where: { program: { in: ids }, active: { not_equals: false } }, limit: 300, depth: 0, ...q, select: { coaches: true, groups: true } }),
      ])
      const noCoach = slots.docs.reduce((n, s) => {
        const groups = s.groups ?? []
        if (groups.length) return n + groups.filter((g) => !(g.coaches?.length) && !(s.coaches?.length)).length
        return n + (s.coaches?.length ? 0 : 1)
      }, 0)
      return waiting.totalDocs + noCoach
    }),
    // Expressions of interest still waiting for a decision (tournaments + Rowville)
    safe(async () => {
      const { docs: rounds } = await p.find({ collection: 'selection-rounds', where: { status: { in: ['open', 'selecting'] } }, limit: 50, depth: 0, ...q, select: { title: true } })
      if (!rounds.length) return 0
      return (await p.count({ collection: 'selection-entries', where: { round: { in: rounds.map((r) => r.id) }, status: { in: ['interested', 'trial-booked', 'attended'] } }, ...q })).totalDocs
    }),
    safe(() => unreadCount(p, { user, side: 'management' })),
    safe(async () => (await p.count({ collection: 'orders', where: { status: { equals: 'paid' } }, ...q })).totalDocs),
    safe(async () => {
      const [reviews, pastDue] = await Promise.all([
        p.count({ collection: 'pdr-submissions', where: { status: { equals: 'pending' } }, ...q }),
        p.count({ collection: 'participants', where: { 'pdr.subscriptionStatus': { equals: 'past_due' } }, ...q }),
      ])
      return reviews.totalDocs + pastDue.totalDocs
    }),
    safe(async () => (await p.count({ collection: 'users', where: { consentReviewStatus: { equals: 'pending' } }, ...q })).totalDocs),
  ])
  // Reports submitted by coaches, waiting for Management review
  const reports = await safe(async () => (await p.count({ collection: 'player-reports', where: { status: { equals: 'submitted' } }, ...q })).totalDocs)
  return { bookings, payments, cover, availability, terms, selections, messages, store, foundation, consent, reports }
}
