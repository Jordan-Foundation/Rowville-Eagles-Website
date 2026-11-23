import type { Payload, Where } from 'payload'
import type { AcademyBooking, AcademyCoach, AcademySession, SessionSummary, User } from '@/payload-types'
import { emailLayout, esc } from '../../lib/email-templates'
import { sendEmail } from '../../lib/email'
import { siteUrl } from '../../lib/payments'
import { localYmd } from '../../lib/time'
import { FOCUS } from './Collection'

const q = { overrideAccess: true, pagination: false } as const
const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null | undefined)) ?? null
const when = (iso: string) => new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
const LOOKBACK_DAYS = 14

export type Pending = { sessionId: number; kind: 'one-on-one' | 'group'; at: string; title: string; players: { sessionId: number; name: string }[]; coachId: number }

/** Who ran a session: the cover coach when there was one, otherwise the booked coach. */
export const deliveredBy = (s: Pick<AcademySession, 'coach' | 'coverCoach'>) => idOf(s.coverCoach) ?? idOf(s.coach)

/** Sessions that have happened (last 14 days) and still need a summary — for one coach, or everyone. */
export async function pendingSummaries(p: Payload, o: { coachId?: number; now?: Date; olderThanHours?: number } = {}): Promise<Pending[]> {
  const now = o.now ?? new Date()
  const until = new Date(now.getTime() - (o.olderThanHours ?? 0) * 3_600_000).toISOString()
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000).toISOString()
  const mine: Where = o.coachId ? { or: [{ coverCoach: { equals: o.coachId } }, { and: [{ coach: { equals: o.coachId } }, { coverCoach: { exists: false } }] }] } : {}
  const { docs } = await p.find({ ...q, collection: 'academy-sessions', where: { and: [{ kind: { in: ['one-on-one', 'group-slot'] } }, { status: { in: ['scheduled', 'completed'] } }, { startsAt: { greater_than_equal: since } }, { startsAt: { less_than: until } }, mine] }, sort: 'startsAt', limit: 2000, depth: 1 })
  if (!docs.length) return []
  const { docs: done } = await p.find({ ...q, collection: 'session-summaries', where: { session: { in: docs.map((d) => d.id) } }, limit: 2000, depth: 0, select: { session: true } })
  const have = new Set(done.map((d) => idOf(d.session)))
  const out: Pending[] = []
  for (const s of docs) {
    if (have.has(s.id)) continue
    const coachId = deliveredBy(s)
    if (!coachId) continue
    if (s.kind === 'one-on-one') {
      const b = typeof s.booking === 'object' ? (s.booking as AcademyBooking | null) : null
      const name = b ? `${b.player.firstName} ${b.player.lastName}` : '1-on-1'
      out.push({ sessionId: s.id, kind: 'one-on-one', at: s.startsAt, title: `1-on-1 · ${name}`, players: [{ sessionId: s.id, name }], coachId })
    } else {
      const groupId = idOf(s.group)
      const { docs: players } = await p.find({ ...q, collection: 'academy-sessions', where: { kind: { equals: 'group-player' }, group: { equals: groupId }, startsAt: { equals: s.startsAt }, status: { in: ['scheduled', 'completed'] } }, limit: 20, depth: 1 })
      if (!players.length) continue
      const names = players.map((x) => ({ sessionId: x.id, name: typeof x.booking === 'object' && x.booking ? `${(x.booking as AcademyBooking).player.firstName} ${(x.booking as AcademyBooking).player.lastName}` : 'Player' }))
      out.push({ sessionId: s.id, kind: 'group', at: s.startsAt, title: `Small group · ${names.map((n) => n.name.split(' ')[0]).join(', ')}`, players: names, coachId })
    }
  }
  return out
}

export type SummaryInput = { workedOn: string[]; wentWell: string; nextSteps: string; homework: string; effort: number | null; privateNotes: string; playerNotes: Record<number, string> }

/** Pure: check what the coach wrote (unit tested). Returns an error or null. */
export function summaryProblem(i: SummaryInput) {
  if (!i.workedOn.length) return 'Tap at least one thing you worked on.'
  if (i.workedOn.length > 3) return 'Pick up to three things you worked on.'
  if (i.workedOn.some((w) => !(FOCUS as readonly string[]).includes(w))) return 'Please pick from the list.'
  if (!i.wentWell.trim() && !i.nextSteps.trim()) return 'Add a line for what went well or the next steps.'
  if (i.effort !== null && !(i.effort >= 1 && i.effort <= 5)) return 'Effort is 1 to 5.'
  return null
}

/** Save a coach's summary for one of their sessions, then email the family. */
export async function saveSummary(p: Payload, user: User, coach: AcademyCoach, sessionId: number, input: SummaryInput) {
  const problem = summaryProblem(input)
  if (problem) return { error: problem }
  const pending = (await pendingSummaries(p, { coachId: coach.id, now: new Date(Date.now() + 12 * 3_600_000) })).find((x) => x.sessionId === sessionId)
  if (!pending) return { error: 'That session already has a summary, or isn’t one of yours.' }
  const doc = await p.create({
    ...q,
    collection: 'session-summaries',
    data: {
      title: `${pending.title} · ${when(pending.at)}`,
      session: sessionId,
      kind: pending.kind,
      coach: coach.id,
      sessionAt: pending.at,
      workedOn: input.workedOn as SessionSummary['workedOn'],
      wentWell: input.wentWell.trim().slice(0, 600),
      nextSteps: input.nextSteps.trim().slice(0, 600),
      homework: input.homework.trim().slice(0, 600),
      effort: input.effort,
      players: pending.kind === 'group' ? pending.players.map((x) => ({ session: x.sessionId, name: x.name, note: (input.playerNotes[x.sessionId] ?? '').trim().slice(0, 400) })) : [],
      privateNotes: input.privateNotes.trim().slice(0, 1500),
      submittedAt: new Date().toISOString(),
      submittedBy: user.id,
    },
  })
  await emailFamilies(p, doc, coach).catch((e) => p.logger.error({ err: e, msg: `Summary email for session ${sessionId} failed` }))
  return { ok: true as const, id: doc.id }
}

/** The family email: what was worked on, how it went, next steps and practice — never the coach & admin notes. */
async function emailFamilies(p: Payload, s: SessionSummary, coach: AcademyCoach) {
  const sessionIds = s.kind === 'group' ? (s.players ?? []).map((x) => idOf(x.session)!) : [idOf(s.session)!]
  const { docs } = await p.find({ ...q, collection: 'academy-sessions', where: { id: { in: sessionIds } }, limit: 20, depth: 1 })
  const stars = s.effort ? `${'★'.repeat(s.effort)}${'☆'.repeat(5 - s.effort)}` : ''
  for (const ses of docs) {
    const b = typeof ses.booking === 'object' ? (ses.booking as AcademyBooking | null) : null
    if (!b?.contact?.email) continue
    const own = (s.players ?? []).find((x) => idOf(x.session) === ses.id)?.note
    const rows: [string, string][] = [
      ['Session', `${s.kind === 'group' ? 'Small group' : '1-on-1'} · ${when(s.sessionAt)}`],
      ['Coach', coach.displayName],
      ['Worked on', (s.workedOn ?? []).join(', ')],
      ...(s.wentWell ? [['What went well', esc(s.wentWell)] as [string, string]] : []),
      ...(own ? [[`${b.player.firstName}`, esc(own)] as [string, string]] : []),
      ...(s.nextSteps ? [['Next steps', esc(s.nextSteps)] as [string, string]] : []),
      ...(s.homework ? [['Practise at home', esc(s.homework)] as [string, string]] : []),
      ...(stars ? [['Effort', stars] as [string, string]] : []),
    ]
    const html = emailLayout('academy', [{ heading: `${esc(b.player.firstName)}’s session summary`, intro: `Hi ${esc(b.contact.firstName)}, here’s a quick summary from ${esc(coach.displayName)} after today’s session.`, rows, cta: { label: 'See all of ' + esc(b.player.firstName) + '’s sessions', href: `${siteUrl()}/account` } }])
    await sendEmail(p, { to: b.contact.email, subject: `${b.player.firstName}’s session summary — Foundation Academy`, html, sender: 'academy', userId: idOf(b.account) ?? undefined })
  }
  await p.update({ ...q, collection: 'session-summaries', id: s.id, data: { emailedAt: new Date().toISOString() } })
}

/** Summaries a family can see for a player's sessions (newest first). */
export async function summariesForSessions(p: Payload, sessionIds: number[]) {
  if (!sessionIds.length) return new Map<number, SessionSummary & { mine?: string | null }>()
  const { docs } = await p.find({ ...q, collection: 'session-summaries', where: { and: [{ hidden: { not_equals: true } }, { or: [{ session: { in: sessionIds } }, { 'players.session': { in: sessionIds } }] }] }, limit: 500, depth: 0 })
  const by = new Map<number, SessionSummary & { mine?: string | null }>()
  for (const d of docs) {
    const { privateNotes: _private, ...shared } = d
    for (const id of sessionIds) {
      if (idOf(d.session) === id) by.set(id, shared as SessionSummary)
      const pl = (d.players ?? []).find((x) => idOf(x.session) === id)
      if (pl) by.set(id, { ...(shared as SessionSummary), mine: pl.note })
    }
  }
  return by
}

/** Latest summaries for a player's earlier sessions — shown to the coach (incl. cover) before a session. */
export async function lastSummariesFor(p: Payload, bookingIds: number[], before: string, limit = 3) {
  const { docs: sessions } = await p.find({ ...q, collection: 'academy-sessions', where: { booking: { in: bookingIds }, startsAt: { less_than: before } }, limit: 200, depth: 0, select: { startsAt: true } })
  if (!sessions.length) return []
  const ids = sessions.map((s) => s.id)
  const { docs } = await p.find({ ...q, collection: 'session-summaries', where: { or: [{ session: { in: ids } }, { 'players.session': { in: ids } }] }, sort: '-sessionAt', limit, depth: 1 })
  return docs
}

// ── End-of-day nudge (8pm), next-morning reminder (9am) ──────────────────────────
const hourIn = (d: Date) => Number(new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', hour: '2-digit', hourCycle: 'h23' }).format(d))

async function onceFor(p: Payload, userId: number, key: string) {
  const { totalDocs } = await p.count({ collection: 'seen-markers', where: { user: { equals: userId }, key: { equals: key } }, overrideAccess: true })
  if (totalDocs) return false
  await p.create({ collection: 'seen-markers', data: { user: userId, key, at: new Date().toISOString() }, overrideAccess: true })
  return true
}

/** Hourly job: at 9am a reminder (email + push) for yesterday's summaries still not written. (Same-day wrap-ups go out 15 minutes after each block — see wrap-up.ts.) */
export async function nudgeCoaches(p: Payload, now = new Date()) {
  const hour = hourIn(now)
  if (hour !== 9) return { skipped: 'not 9am' }
  const reminder = true
  const today = localYmd(now)
  const yesterday = localYmd(new Date(now.getTime() - 86_400_000))
  const day = reminder ? yesterday : today
  const all = (await pendingSummaries(p, { now })).filter((x) => localYmd(new Date(x.at)) === day)
  const byCoach = new Map<number, Pending[]>()
  for (const x of all) byCoach.set(x.coachId, [...(byCoach.get(x.coachId) ?? []), x])
  let sent = 0
  for (const [coachId, list] of byCoach) {
    const coach = await p.findByID({ ...q, collection: 'academy-coaches', id: coachId, depth: 1 }).catch(() => null)
    const user = coach && typeof coach.user === 'object' ? (coach.user as User) : null
    if (!user?.email) continue
    if (!(await onceFor(p, user.id, `${reminder ? 'summary-reminder' : 'summary-nudge'}:${day}`))) continue
    const n = list.length
    const link = `${siteUrl()}/coach/summaries`
    const title = reminder ? `Reminder: ${n} session summar${n === 1 ? 'y' : 'ies'} from yesterday` : `${n} session summar${n === 1 ? 'y' : 'ies'} to write`
    const html = emailLayout('academy', [{ heading: title, intro: `Hi ${esc(user.firstName || coach!.displayName)} — ${reminder ? 'these are still waiting from yesterday' : 'thanks for today'}. Two minutes each: what you worked on, what went well and next steps. Families get them straight away, and it helps whoever coaches them next.`, rows: list.map((x) => [when(x.at), x.title] as [string, string]), cta: { label: n === 1 ? 'Write the summary' : `Write ${n} summaries`, href: link } }])
    await sendEmail(p, { to: user.email, subject: title, html, sender: 'academy', userId: user.id, push: { type: 'reminders', url: '/coach/summaries', body: list.map((x) => x.title).join(' · '), tag: `summaries-${day}` } })
    sent++
  }
  return { sent, reminder }
}

/** Management badge: summaries more than 48 hours late. */
export const overdueSummaries = async (p: Payload) => (await pendingSummaries(p, { olderThanHours: 48 })).length
