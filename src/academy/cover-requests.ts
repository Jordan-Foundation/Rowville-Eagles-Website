import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Payload, PayloadRequest } from 'payload'
import type { AcademyCoach, AcademySession, User } from '@/payload-types'
import { emailLayout, esc } from '../lib/email-templates'
import { sendEmail } from '../lib/email'
import { sendSms } from '../lib/sms'
import { formatDate } from '../lib/format'
import { siteUrl } from '../lib/payments'
import { academyBrand } from './brand'

/**
 * Cover between coaches:
 *  - Management assigns a cover coach → that coach is asked to confirm or decline (email + text).
 *  - A session needs cover → every other active coach is emailed "Can you take it?"; the first one who's free gets it.
 * Links are signed, so they work without logging in and can't be guessed.
 */
const q = { overrideAccess: true, depth: 0 } as const
const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null | undefined)) ?? null
const when = (iso: string) => formatDate(iso, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })

export type CoverMode = 'a' | 'p' // a = asked to cover (confirm/decline), p = pick it up
export class CoverError extends Error {}

const sign = (s: string) => createHmac('sha256', process.env.PAYLOAD_SECRET || 'dev-secret').update(`cover:${s}`).digest('base64url').slice(0, 22)
export const coverToken = (mode: CoverMode, sessionId: number, coachId: number) => `${mode}${sessionId}-${coachId}-${sign(`${mode}${sessionId}-${coachId}`)}`
export function readCoverToken(token: string): { mode: CoverMode; sessionId: number; coachId: number } | null {
  const m = /^([ap])(\d+)-(\d+)-([\w-]{22})$/.exec(token)
  if (!m) return null
  const want = Buffer.from(sign(`${m[1]}${m[2]}-${m[3]}`))
  const got = Buffer.from(m[4])
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null
  return { mode: m[1] as CoverMode, sessionId: Number(m[2]), coachId: Number(m[3]) }
}
export const coverLink = (mode: CoverMode, sessionId: number, coachId: number) => `${siteUrl()}/cover/${coverToken(mode, sessionId, coachId)}`

async function describe(p: Payload, s: AcademySession) {
  if (s.kind === 'group-slot') {
    const g = s.group ? await p.findByID({ collection: 'academy-groups', id: rel(s.group)!, ...q, disableErrors: true }) : null
    return { what: 'Small group session', who: g ? `Small group ${g.reference}` : 'Small group' }
  }
  const b = s.booking ? await p.findByID({ collection: 'academy-bookings', id: rel(s.booking)!, ...q, disableErrors: true }) : null
  return { what: '1-on-1 session', who: b ? `${b.player.firstName} ${b.player.lastName}` : 'A player' }
}

const coachUser = async (p: Payload, c: AcademyCoach) => (rel(c.user) ? await p.findByID({ collection: 'users', id: rel(c.user)!, ...q, disableErrors: true }) : null)

/** Ask the assigned cover coach to confirm (called when a cover coach is set on a session). */
export async function askCoverCoach(p: Payload, sessionId: number, req?: PayloadRequest) {
  const s = await p.findByID({ collection: 'academy-sessions', id: sessionId, ...q, req })
  const coachId = rel(s.coverCoach)
  if (!coachId) return
  const coach = await p.findByID({ collection: 'academy-coaches', id: coachId, ...q, req })
  const booked = rel(s.coach) ? await p.findByID({ collection: 'academy-coaches', id: rel(s.coach)!, ...q, req, disableErrors: true }) : null
  const user = await coachUser(p, coach)
  const d = await describe(p, s)
  const link = coverLink('a', s.id, coachId)
  await p.update({ collection: 'academy-sessions', id: s.id, ...q, req, context: { coverHandled: true }, data: { coverStatus: 'asked', coverAskedAt: new Date().toISOString() } })
  if (user?.email) {
    await sendEmail(p, {
      to: user.email,
      subject: `Can you cover ${d.what.toLowerCase()} — ${formatDate(s.startsAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}?`,
      html: emailLayout('academy', [{ heading: 'You’ve been asked to cover a session', intro: `Hi ${esc(coach.displayName)} — the Academy has asked you to cover this session${booked ? ` for ${esc(booked.displayName)}` : ''}. Please confirm or let us know you can’t.`, rows: [['When', when(s.startsAt)], ['Session', d.what], ['Player', d.who], ...(s.coverNote ? ([['Handover', s.coverNote]] as [string, string][]) : [])], cta: { label: 'Confirm or decline', href: link } }]),
      sender: 'academy',
      userId: user.id,
      push: { type: 'changes', url: link, body: `${d.what} · ${d.who}. Tap to confirm or decline.`, tag: `cover-${s.id}` },
    })
  }
  if (user?.phone) await sendSms(p, { to: user.phone, kind: 'coach_alert', userId: user.id, body: `Foundation Academy: can you cover ${d.what.toLowerCase()} on ${formatDate(s.startsAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}? Confirm or decline: ${link}` })
}

/** Email every other active coach: "This session needs cover — can you take it?" (one email per coach, listing the sessions). */
export async function askCoachesToCover(p: Payload, sessionIds: number[], o: { exclude?: number[] } = {}) {
  const sessions = (await Promise.all(sessionIds.map((id) => p.findByID({ collection: 'academy-sessions', id, ...q, disableErrors: true }))))
    .filter((s): s is AcademySession => !!s && s.needsCover === true && !rel(s.coverCoach) && s.kind !== 'group-player' && new Date(s.startsAt) > new Date())
  if (!sessions.length) return 0
  const skip = new Set([...(o.exclude ?? []), ...sessions.map((s) => rel(s.coach)).filter(Boolean) as number[]])
  const { docs: coaches } = await p.find({ collection: 'academy-coaches', where: { active: { not_equals: false } }, limit: 200, pagination: false, ...q })
  const described = await Promise.all(sessions.map(async (s) => ({ s, d: await describe(p, s) })))
  let sent = 0
  for (const c of coaches) {
    if (skip.has(c.id)) continue
    const user = await coachUser(p, c)
    if (!user?.email) continue
    const list = described.map(({ s, d }) => `<a href="${coverLink('p', s.id, c.id)}">${esc(formatDate(s.startsAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))} — ${esc(d.what)} (${esc(d.who)})</a>`).join('<br>')
    await sendEmail(p, {
      to: user.email,
      subject: sessions.length === 1 ? `Cover needed ${formatDate(sessions[0].startsAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} — can you take it?` : `${sessions.length} sessions need cover — can you take any?`,
      html: emailLayout('academy', [{ heading: sessions.length === 1 ? 'A session needs cover' : 'Sessions need cover', intro: `Hi ${esc(c.displayName)} — can you pick up ${sessions.length === 1 ? 'this session' : 'any of these'}? The first coach to say yes (and who’s free then) gets it.<br><br>${list}`, ...(sessions.length === 1 ? { cta: { label: 'I can take it', href: coverLink('p', sessions[0].id, c.id) } } : {}) }]),
      sender: 'academy',
      userId: user.id,
      push: { type: 'changes', url: sessions.length === 1 ? coverLink('p', sessions[0].id, c.id) : '/coach', body: described.map(({ s, d }) => `${formatDate(s.startsAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} ${d.what}`).join(' · ') },
    })
    sent++
  }
  return sent
}

/** Is the coach already busy then (their own sessions, cover they've taken, or a camp/away block)? */
async function busyAt(p: Payload, coachId: number, startsAt: string) {
  const t = Date.parse(startsAt)
  const from = new Date(t - 59 * 60_000).toISOString()
  const to = new Date(t + 59 * 60_000).toISOString()
  const { totalDocs } = await p.count({ collection: 'academy-sessions', where: { or: [{ coach: { equals: coachId } }, { coverCoach: { equals: coachId } }], status: { in: ['scheduled', 'held'] }, startsAt: { greater_than: from, less_than: to } }, overrideAccess: true })
  if (totalDocs) return true
  const blocks = await p.count({ collection: 'coach-blocks', where: { coach: { equals: coachId }, from: { less_than: to }, to: { greater_than: from } }, overrideAccess: true }).catch(() => ({ totalDocs: 0 }))
  return blocks.totalDocs > 0
}

async function tellManagement(p: Payload, subject: string, intro: string) {
  await sendEmail(p, { to: academyBrand.email, subject, html: emailLayout('academy', [{ heading: subject, intro, cta: { label: 'Sessions needing cover', href: `${siteUrl()}/management/academy#cover` } }]), sender: 'academy' }).catch((e) => p.logger.error({ err: e, msg: 'Cover notice to Management failed' }))
}

/** Set the cover coach on a session (a small group date updates all its rows). */
async function setCover(p: Payload, s: AcademySession, coachId: number | null, status: 'confirmed' | 'declined' | null) {
  if (s.kind === 'group-slot' && rel(s.group)) {
    const { setGroupCover } = await import('./group-admin')
    await setGroupCover(p, { groupId: rel(s.group)!, startsAt: s.startsAt, needsCover: true, coverCoach: coachId, coverStatus: status })
  } else {
    await p.update({ collection: 'academy-sessions', id: s.id, ...q, context: { coverHandled: true }, data: { coverCoach: coachId, coverStatus: status, coverAnsweredAt: new Date().toISOString() } })
  }
}

/** What the link's page shows and allows. */
export async function coverState(p: Payload, token: string) {
  const t = readCoverToken(token)
  if (!t) return null
  const s = await p.findByID({ collection: 'academy-sessions', id: t.sessionId, ...q, disableErrors: true })
  const coach = await p.findByID({ collection: 'academy-coaches', id: t.coachId, ...q, disableErrors: true })
  if (!s || !coach) return null
  const d = await describe(p, s)
  const past = new Date(s.startsAt) <= new Date() || !['scheduled', 'held'].includes(s.status)
  const mine = rel(s.coverCoach) === coach.id
  const state =
    past ? 'gone'
    : t.mode === 'a' ? (mine ? (s.coverStatus === 'confirmed' ? 'confirmed' : 'asked') : 'changed')
    : mine ? 'confirmed' : rel(s.coverCoach) ? 'taken' : s.needsCover ? 'open' : 'gone'
  return { ...t, session: s, coach, d, state: state as 'gone' | 'confirmed' | 'asked' | 'changed' | 'taken' | 'open' }
}

/** Confirm / decline (asked) or take (pick-up). */
export async function answerCover(p: Payload, token: string, answer: 'confirm' | 'decline' | 'take') {
  const st = await coverState(p, token)
  if (!st) throw new CoverError('This link isn’t valid.')
  const { session: s, coach, d } = st
  const label = `${d.what} ${formatDate(s.startsAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} (${d.who})`
  if (answer === 'take') {
    if (st.mode !== 'p') throw new CoverError('This link isn’t for picking up sessions.')
    if (st.state === 'confirmed') return 'You’re already covering this session.'
    if (st.state !== 'open') throw new CoverError(st.state === 'taken' ? 'Another coach has already picked this one up — thanks for offering!' : 'This session doesn’t need cover any more.')
    if (await busyAt(p, coach.id, s.startsAt)) throw new CoverError('You already have a session or block at that time, so we can’t give you this one.')
    // Re-check just before taking it, so two coaches can't both get it
    const fresh = await p.findByID({ collection: 'academy-sessions', id: s.id, ...q })
    if (rel(fresh.coverCoach)) throw new CoverError('Another coach has just picked this one up — thanks for offering!')
    await setCover(p, s, coach.id, 'confirmed')
    await tellManagement(p, `Cover picked up: ${coach.displayName}`, `${esc(coach.displayName)} has picked up the ${esc(label)}. Nothing else to do — it’s confirmed.`)
    return 'Thanks — it’s yours. The session is now in your Coach portal.'
  }
  if (st.mode !== 'a') throw new CoverError('This link isn’t for confirming cover.')
  if (st.state === 'changed') throw new CoverError('The Academy has changed who’s covering this session — no action needed.')
  if (st.state === 'gone') throw new CoverError('This session has already happened or been cancelled.')
  if (answer === 'confirm') {
    if (st.state === 'confirmed') return 'You’ve already confirmed — thanks!'
    await p.update({ collection: 'academy-sessions', id: s.id, ...q, context: { coverHandled: true }, data: { coverStatus: 'confirmed', coverAnsweredAt: new Date().toISOString() } })
    if (s.kind === 'group-slot' && rel(s.group)) {
      const { docs } = await p.find({ collection: 'academy-sessions', where: { group: { equals: rel(s.group) }, startsAt: { equals: s.startsAt }, kind: { equals: 'group-player' } }, limit: 50, pagination: false, ...q })
      for (const r of docs) await p.update({ collection: 'academy-sessions', id: r.id, ...q, context: { coverHandled: true }, data: { coverStatus: 'confirmed' } })
    }
    await tellManagement(p, `Cover confirmed: ${coach.displayName}`, `${esc(coach.displayName)} confirmed they’ll cover the ${esc(label)}.`)
    return 'Thanks — you’re confirmed. The session is in your Coach portal.'
  }
  await setCover(p, s, null, 'declined')
  await tellManagement(p, `Cover declined: ${coach.displayName}`, `${esc(coach.displayName)} can’t cover the ${esc(label)}. The other coaches have been asked if they can pick it up — or assign someone else.`)
  await askCoachesToCover(p, [s.id], { exclude: [coach.id] }).catch((e) => p.logger.error({ err: e, msg: 'Cover pick-up emails failed' }))
  return 'Thanks for letting us know — we’ll find someone else.'
}

export type { User }
