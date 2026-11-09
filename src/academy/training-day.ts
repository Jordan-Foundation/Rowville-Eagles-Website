import type { Payload } from 'payload'
import type { AcademyCoach, Participant, User } from '@/payload-types'
import { coachGroups } from './terms/coach-groups'
import { coachSessions } from './coach-sessions'
import { localToUtc, localYmd } from '../lib/time'

const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null | undefined) ?? null)
const q = { overrideAccess: true } as const

export type RosterRow = {
  id: number
  name: string
  medical?: string | null
  emergency?: string | null
  noPhotos?: boolean
  parent: { name: string; phone?: string | null; accountId?: number | null }
}
export type TrainingBlock = {
  key: string
  kind: 'group' | 'team'
  title: string
  subtitle: string
  startsAt: string
  rows: RosterRow[]
  present: number[] | null
  takenAt?: string | null
}

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const weekdayOf = (ymd: string) => WEEKDAY[new Date(`${ymd}T00:00:00Z`).getUTCDay()]
export const todayYmd = () => localYmd(new Date())

/** Everything a coach runs on one day: Academy groups and team trainings (with rosters), and 1-on-1s. */
export async function trainingDay(p: Payload, user: User, coach: AcademyCoach, ymd: string) {
  const [groups, teams, ones] = await Promise.all([
    coachGroups(p, coach.id),
    p.find({ pagination: false, collection: 'teams', where: { coaches: { in: [user.id] }, archived: { not_equals: true } }, limit: 50, depth: 0, ...q }),
    coachSessions(p, coach.id, { from: localToUtc(ymd, '00:00'), to: localToUtc(ymd, '23:59') }),
  ])
  const blocks: TrainingBlock[] = []
  for (const g of groups) {
    const s = g.sessions.find((x) => x.date === ymd && !x.cancelled)
    if (!s) continue
    blocks.push({
      key: `group:${g.slot.id}:${g.groupName ? (g.key.split(':')[1] ?? '') : ''}:${ymd}`,
      kind: 'group',
      title: g.title,
      subtitle: g.program.title,
      startsAt: s.startsAt,
      present: null,
      rows: g.players.map((r) => ({
        id: r.id,
        name: `${r.player.firstName} ${r.player.lastName}`,
        medical: r.player.medical,
        emergency: r.player.emergencyName ? `${r.player.emergencyName}${r.player.emergencyPhone ? ` · ${r.player.emergencyPhone}` : ''}` : null,
        noPhotos: r.player.photoConsent === false,
        parent: { name: `${r.contact.firstName} ${r.contact.lastName}`, phone: r.contact.phone, accountId: rel(r.account) },
      })),
    })
  }
  const day = weekdayOf(ymd)
  for (const t of teams.docs) {
    for (const tr of (t.training ?? []).filter((x) => x.day === day)) {
      const { docs: members } = await p.find({ pagination: false, collection: 'team-members', where: { team: { equals: t.id }, active: { equals: true } }, limit: 200, depth: 1, ...q })
      blocks.push({
        key: `team:${t.id}:${ymd}${(t.training ?? []).filter((x) => x.day === day).length > 1 ? `:${tr.start}` : ''}`,
        kind: 'team',
        title: t.name,
        subtitle: [`Team training`, tr.location].filter(Boolean).join(' · '),
        startsAt: localToUtc(ymd, tr.start).toISOString(),
        present: null,
        rows: members
          .map((m) => {
            const kid = m.participant as Participant
            const parent = m.account as User
            return {
              id: m.id,
              name: `${kid?.firstName ?? ''} ${kid?.lastName ?? ''}`.trim(),
              medical: kid?.medical?.conditions,
              emergency: kid?.medical?.emergencyContact ? `${kid.medical.emergencyContact}${kid.medical.emergencyPhone ? ` · ${kid.medical.emergencyPhone}` : ''}` : null,
              noPhotos: kid?.photoConsent === false,
              parent: { name: [parent?.firstName, parent?.lastName].filter(Boolean).join(' ') || parent?.email || '', phone: parent?.phone, accountId: parent?.id ?? null },
            }
          })
          .sort((a, b) => a.name.localeCompare(b.name)),
      })
    }
  }
  if (blocks.length) {
    const { docs: saved } = await p.find({ pagination: false, collection: 'training-attendance', where: { key: { in: blocks.map((b) => b.key) } }, limit: 50, depth: 0, ...q })
    for (const b of blocks) {
      const s = saved.find((x) => x.key === b.key)
      if (s) {
        b.present = Array.isArray(s.present) ? (s.present as number[]) : []
        b.takenAt = s.takenAt
      }
    }
  }
  blocks.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  return { blocks, oneOnOnes: ones }
}

/** Save the ticks for one group/team training (only for a training this coach runs that day, only its own players). */
export async function saveAttendance(p: Payload, user: User, coach: AcademyCoach, key: string, present: number[]) {
  const ymd = key.split(':').find((x) => /^\d{4}-\d{2}-\d{2}$/.test(x))
  if (!ymd) throw new Error('Unknown training.')
  const { blocks } = await trainingDay(p, user, coach, ymd)
  const block = blocks.find((b) => b.key === key)
  if (!block) throw new Error('That training isn’t one of yours.')
  const roster = new Set(block.rows.map((r) => r.id))
  const ticks = [...new Set(present.filter((id) => roster.has(id)))]
  const [kind, a, b] = key.split(':')
  const data = {
    key,
    title: `${block.title} · ${ymd}`,
    kind: block.kind,
    date: ymd,
    slot: kind === 'group' ? Number(a) : undefined,
    groupId: kind === 'group' ? b || undefined : undefined,
    team: kind === 'team' ? Number(a) : undefined,
    present: ticks,
    presentCount: ticks.length,
    rosterCount: roster.size,
    takenBy: user.id,
    takenAt: new Date().toISOString(),
  }
  const { docs } = await p.find({ pagination: false, collection: 'training-attendance', where: { key: { equals: key } }, limit: 1, depth: 0, ...q })
  if (docs[0]) await p.update({ collection: 'training-attendance', id: docs[0].id, data, ...q })
  else await p.create({ collection: 'training-attendance', data, ...q })
  return { present: ticks.length, roster: roster.size }
}
