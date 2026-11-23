import type { Payload } from 'payload'
import type { AcademyCoach, Program } from '@/payload-types'
import { localYmd, TZ } from '../lib/time'
import { slotSessions } from './terms/slots'
import { ageGroupOf } from './session-lengths'

/**
 * Booked RFA trial players (paid or still in checkout), grouped into sessions: Management dashboard list and the
 * 1 day / 3 hours / 15 minutes push reminders to Management. Cancelled trials simply drop out.
 */

const q = { overrideAccess: true, pagination: false } as const
const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : ((v as number | null | undefined) ?? null))

export type TrialPlayer = { bookingId: number; name: string; short: string; birthYear: number | null; ageGroup: string | null; reference: string | null }
export type TrialSession = { key: string; startsAt: string; ymd: string; program: string; programId: number; venue: string | null; coaches: string[]; players: TrialPlayer[] }

/** Stable id for a trial session (program + start time) — used in links and reminder keys. */
export const sessionKey = (programId: number, startsAt: string) => `${programId}-${new Date(startsAt).getTime()}`

export async function upcomingTrials(p: Payload, o: { from?: Date; days?: number | null } = {}): Promise<TrialSession[]> {
  const from = o.from ?? new Date()
  const to = o.days ? new Date(from.getTime() + o.days * 86_400_000) : null
  const { docs: bookings } = await p.find({
    ...q,
    collection: 'bookings',
    where: { bookingType: { equals: 'trial' }, status: { equals: 'paid' }, sessionStart: { greater_than_equal: new Date(from.getTime() - 3 * 3_600_000).toISOString(), ...(to ? { less_than: to.toISOString() } : {}) } },
    sort: 'sessionStart',
    limit: 2000,
    depth: 0,
  })
  if (!bookings.length) return []
  const programIds = [...new Set(bookings.map((b) => rel(b.program)).filter((x): x is number => Boolean(x)))]
  const [{ docs: programs }, { docs: slots }, settings] = await Promise.all([
    p.find({ ...q, collection: 'programs', where: { id: { in: programIds } }, limit: programIds.length, depth: 0 }),
    p.find({ ...q, collection: 'academy-term-slots', where: { program: { in: programIds } }, limit: 500, depth: 0 }),
    p.findGlobal({ slug: 'site-settings', depth: 0 }).catch(() => null),
  ])
  const coachIds = [...new Set(slots.flatMap((s) => [...(s.coaches ?? []), ...(s.groups ?? []).flatMap((g) => g.coaches ?? [])].map(rel)).filter((x): x is number => Boolean(x)))]
  const { docs: coaches } = coachIds.length ? await p.find({ ...q, collection: 'academy-coaches', where: { id: { in: coachIds } }, limit: coachIds.length, depth: 0, select: { displayName: true } }) : { docs: [] as AcademyCoach[] }
  const coachName = new Map(coaches.map((c) => [c.id, c.displayName]))
  const progById = new Map(programs.map((x) => [x.id, x as Program]))
  const out = new Map<string, TrialSession>()
  for (const b of bookings) {
    const pid = rel(b.program)
    const prog = pid ? progById.get(pid) : null
    if (!prog || !b.sessionStart) continue
    const startsAt = new Date(b.sessionStart).toISOString()
    // The training time this trial joins: same program, same start, includes the player's year of birth
    const slot = slots.find((s) => rel(s.program) === pid && (!b.birthYear || (s.birthYears ?? []).includes(b.birthYear)) && slotSessions(s, prog).some((x) => x.startsAt === startsAt))
    const key = sessionKey(pid!, startsAt)
    const sess = out.get(key) ?? {
      key, startsAt, ymd: localYmd(new Date(startsAt)), program: prog.title, programId: pid!,
      venue: slot?.venue || prog.location || settings?.ground?.name || null,
      coaches: [] as string[], players: [] as TrialPlayer[],
    }
    if (slot) for (const id of [...(slot.coaches ?? []), ...(slot.groups ?? []).flatMap((g) => g.coaches ?? [])].map(rel)) { const n = id ? coachName.get(id) : null; if (n && !sess.coaches.includes(n)) sess.coaches.push(n) }
    const first = b.player?.firstName || b.contact?.firstName || ''
    const last = b.player?.lastName || ''
    sess.players.push({ bookingId: b.id, name: `${first} ${last}`.trim() || 'Trial player', short: `${first}${last ? ` ${last[0]}` : ''}`.trim(), birthYear: b.birthYear ?? null, ageGroup: b.birthYear ? ageGroupOf(b.birthYear, new Date(startsAt).getFullYear()) : null, reference: b.reference ?? null })
    out.set(key, sess)
  }
  for (const s of out.values()) s.players.sort((x, y) => x.name.localeCompare(y.name))
  return [...out.values()].filter((s) => new Date(s.startsAt).getTime() > from.getTime() - 3 * 3_600_000).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

/** Sessions grouped by local day. */
export const byDay = (sessions: TrialSession[]) => {
  const days = new Map<string, TrialSession[]>()
  for (const s of sessions) days.set(s.ymd, [...(days.get(s.ymd) ?? []), s])
  return [...days.entries()]
}

// ── Push reminders to Management ─────────────────────────────────────────────

export const REMINDERS = [
  { key: '1d', ms: 24 * 3_600_000 },
  { key: '3h', ms: 3 * 3_600_000 },
  { key: '15m', ms: 15 * 60_000 },
] as const

/** The reminder due now for a session (the latest whose time has passed), or null. Earlier missed ones are skipped. */
export function dueReminder(startsAt: string, now: Date) {
  const t = new Date(startsAt).getTime() - now.getTime()
  if (t <= 0) return null
  const due = REMINDERS.filter((r) => t <= r.ms)
  return due.length ? due[due.length - 1] : null
}

const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-AU', { timeZone: TZ, ...o }).format(new Date(iso))

/** "U10 RFA, today 4:30pm, Rowville: 2 trial players attending — Sam K (2016), Mia L (2016)." */
export function reminderText(s: TrialSession, now: Date) {
  const groups = [...new Set(s.players.map((x) => x.ageGroup).filter(Boolean))].join('/')
  const dayWord = s.ymd === localYmd(now) ? 'today' : s.ymd === localYmd(new Date(now.getTime() + 86_400_000)) ? 'tomorrow' : fmt(s.startsAt, { weekday: 'long' })
  const time = fmt(s.startsAt, { hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase()
  const who = s.players.map((x) => `${x.short}${x.birthYear ? ` (${x.birthYear})` : ''}`).join(', ')
  return `${groups ? `${groups} ` : ''}RFA, ${dayWord} ${time}${s.venue ? `, ${s.venue}` : ''}: ${s.players.length} trial player${s.players.length === 1 ? '' : 's'} attending — ${who}.`
}

/** Who gets the reminders: the chosen Management users, or everyone with the admin/committee role. */
export async function trialAlertRecipients(p: Payload) {
  const s = await p.findGlobal({ slug: 'academy-settings', depth: 0, overrideAccess: true }).catch(() => null)
  const chosen = ((s?.trialAlertUsers ?? []) as unknown[]).map(rel).filter((x): x is number => Boolean(x))
  if (chosen.length) return chosen
  const { docs } = await p.find({ ...q, collection: 'users', where: { roles: { in: ['admin', 'committee'] } }, limit: 200, depth: 0, select: { email: true } })
  return docs.map((u) => u.id)
}

/** Every few minutes: one push per session (not per player) at 1 day, 3 hours and 15 minutes before. Idempotent. */
export async function sendTrialReminders(p: Payload, now = new Date()) {
  const sessions = await upcomingTrials(p, { from: now, days: 2 })
  const recipients = await trialAlertRecipients(p)
  if (!recipients.length) return { sessions: sessions.length, sent: 0 }
  const { notifyUser } = await import('../lib/app-install')
  let sent = 0
  for (const s of sessions) {
    const r = dueReminder(s.startsAt, now)
    if (!r) continue
    for (const userId of recipients) {
      // One marker per user, session and reminder (unique in the database) — a second run can't send it again
      const key = `rfa-trial:${s.key}:${r.key}`
      const claimed = await p.create({ collection: 'seen-markers', overrideAccess: true, data: { user: userId, key, at: now.toISOString() } }).then(() => true, () => false)
      if (!claimed) continue
      // Mark the earlier, missed reminders as done too (late bookings only get the remaining ones)
      for (const earlier of REMINDERS.slice(0, REMINDERS.findIndex((x) => x.key === r.key))) await p.create({ collection: 'seen-markers', overrideAccess: true, data: { user: userId, key: `rfa-trial:${s.key}:${earlier.key}`, at: now.toISOString() } }).catch(() => null)
      sent += await notifyUser(p, userId, 'reminders', { title: `RFA trial${s.players.length === 1 ? '' : 's'} ${r.key === '1d' ? 'tomorrow' : r.key === '3h' ? 'in 3 hours' : 'in 15 minutes'}`, body: reminderText(s, now), url: `/management/trials?session=${s.key}#s-${s.key}`, tag: `rfa-trial-${s.key}` })
    }
  }
  return { sessions: sessions.length, sent }
}
