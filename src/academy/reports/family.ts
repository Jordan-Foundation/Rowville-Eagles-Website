import type { Payload } from 'payload'
import type { PlayerReport, User } from '@/payload-types'
import { hasRole } from '../../access'
import { curriculum, standardFor } from '../curriculum/load'
import { LEVELS, STRANDS } from '../curriculum/levels'

const idOf = (v: unknown): number | null => (v && typeof v === 'object' ? (v as { id: number }).id : typeof v === 'number' ? v : null)

/** Can this person read the report? The family (released reports only), or Management. */
export async function canSeeReport(p: Payload, r: PlayerReport, user: User) {
  if (hasRole(user, 'admin') || hasRole(user, 'committee')) return true
  if (r.status !== 'released') return false
  if (idOf(r.account) === user.id) return true
  const pid = idOf(r.participant)
  if (pid) {
    const kid = await p.findByID({ collection: 'participants', id: pid, depth: 0, overrideAccess: true, disableErrors: true })
    if (kid && idOf(kid.account) === user.id) return true
  }
  const rid = idOf(r.registration)
  if (rid) {
    const reg = await p.findByID({ collection: 'academy-registrations', id: rid, depth: 0, overrideAccess: true, disableErrors: true })
    if (reg && idOf(reg.account) === user.id) return true
  }
  return false
}

/** Everything the report card needs: rows with the standard for the player's level, coach name, cycle name. */
export async function reportCard(p: Payload, r: PlayerReport) {
  const all = await curriculum(p)
  const cycle = typeof r.cycle === 'object' ? r.cycle : await p.findByID({ collection: 'report-cycles', id: r.cycle, depth: 0, overrideAccess: true })
  const coachId = idOf(r.coach)
  const coach = coachId ? await p.findByID({ collection: 'users', id: coachId, depth: 0, overrideAccess: true, disableErrors: true }) : null
  const level = LEVELS.find((l) => l.key === r.level)!
  return {
    cycleName: cycle.name,
    level,
    coachName: coach ? [coach.firstName, coach.lastName].filter(Boolean).join(' ') : null,
    rows: STRANDS.map((s) => {
      const e = (r.strands ?? []).find((x) => x.strand === s.key)
      return { strand: s.name, standard: standardFor(all, r.level, s.key)?.standard ?? null, rating: e?.rating ?? null, comment: e?.comment ?? null }
    }),
  }
}

/** Released reports for a player, newest first. */
export async function releasedFor(p: Payload, participantId: number) {
  const { docs } = await p.find({ collection: 'player-reports', where: { participant: { equals: participantId }, status: { equals: 'released' } }, sort: '-releasedAt', limit: 50, depth: 1, overrideAccess: true })
  return docs
}
