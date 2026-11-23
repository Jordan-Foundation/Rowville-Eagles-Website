import type { Payload } from 'payload'
import type { AcademyBooking, AcademyCoach, AcademyTerm, User } from '@/payload-types'
import { localYmd } from '../lib/time'
import { siteUrl } from '../lib/payments'
import { formatDate } from '../lib/format'
import { sendEmail } from '../lib/email'
import { emailLayout } from '../lib/email-templates'
import { trainingDay } from './training-day'
import { pendingSummaries } from './summaries/service'

/**
 * End-of-block wrap-up for coaches: 15 minutes after the last session in a block (sessions with gaps of
 * 45 minutes or less), one email + phone notification with a link to mark the day's attendance and write
 * the day's session summaries. Nothing is sent when everything is already done.
 */

export const BLOCK_GAP_MIN = 45
export const WRAP_UP_AFTER_MIN = 15

export type DayItem = {
  key: string
  kind: 'one-on-one' | 'small-group' | 'group' | 'team'
  label: string
  startsAt: string
  endsAt: string
  attendanceDone: boolean
  href: string
  sessionId?: number
  status?: string
}

/** Consecutive sessions → blocks (a gap longer than `gapMin` starts a new block). Pure — unit tested. */
export function blocksOf(items: Pick<DayItem, 'startsAt' | 'endsAt'>[], gapMin = BLOCK_GAP_MIN) {
  const sorted = [...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const out: { startsAt: string; endsAt: string }[] = []
  for (const it of sorted) {
    const last = out[out.length - 1]
    if (last && new Date(it.startsAt).getTime() - new Date(last.endsAt).getTime() <= gapMin * 60_000) {
      if (it.endsAt > last.endsAt) last.endsAt = it.endsAt
    } else out.push({ startsAt: it.startsAt, endsAt: it.endsAt })
  }
  return out
}

/** The wrap-up due now for a coach's day, if any: the most recent block that ended at least 15 minutes ago (within 3 hours). */
export function dueBlock(blocks: { startsAt: string; endsAt: string }[], now: Date) {
  const due = blocks.filter((b) => {
    const end = new Date(b.endsAt).getTime()
    return now.getTime() >= end + WRAP_UP_AFTER_MIN * 60_000 && now.getTime() < end + 3 * 3_600_000
  })
  return due.length ? due[due.length - 1] : null
}

/** Everything the coach ran on a day, with whether attendance is marked, plus the session summaries still to write. */
export async function coachDay(p: Payload, user: User, coach: AcademyCoach, ymd: string, now = new Date()) {
  const { blocks, oneOnOnes } = await trainingDay(p, user, coach, ymd)
  const items: DayItem[] = []
  for (const b of blocks) {
    items.push({ key: b.key, kind: b.kind, label: b.title, startsAt: b.startsAt, endsAt: b.endsAt, attendanceDone: b.present !== null, href: `/coach/today?date=${ymd}#${encodeURIComponent(b.key)}` })
  }
  for (const x of oneOnOnes) {
    if (x.role === 'covered') continue // the cover coach does this one
    const b = x.booking as AcademyBooking
    const term = b && typeof b.term === 'object' ? (b.term as AcademyTerm) : null
    const minutes = term?.sessionMinutes || 60
    const group = x.session.kind === 'group-player'
    const groupId = group && x.session.group ? (typeof x.session.group === 'object' ? x.session.group.id : x.session.group) : null
    items.push({
      key: `s${x.session.id}`,
      kind: group ? 'small-group' : 'one-on-one',
      label: `${group ? 'Small group' : '1-on-1'} · ${b?.player?.firstName ?? ''} ${b?.player?.lastName ?? ''}`.trim(),
      startsAt: x.session.startsAt,
      endsAt: new Date(new Date(x.session.startsAt).getTime() + minutes * 60_000).toISOString(),
      attendanceDone: x.session.status !== 'scheduled',
      href: group && groupId ? `/coach/sessions/group/${groupId}/session?at=${encodeURIComponent(x.session.startsAt)}` : `/coach/sessions/${x.session.id}`,
      sessionId: x.session.id,
      status: x.session.status,
    })
  }
  items.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const summaries = (await pendingSummaries(p, { coachId: coach.id, now })).filter((s) => localYmd(new Date(s.at)) === ymd)
  const started = items.filter((i) => new Date(i.startsAt).getTime() <= now.getTime())
  return { items, attendanceToMark: started.filter((i) => !i.attendanceDone), summaries }
}

/** Every 5 minutes: send each coach their wrap-up 15 minutes after a block ends (once per block, only if something's left). */
export async function sendWrapUps(p: Payload, now = new Date()) {
  const ymd = localYmd(now)
  const { docs: coaches } = await p.find({ collection: 'academy-coaches', where: { active: { not_equals: false } }, depth: 1, limit: 200, overrideAccess: true, pagination: false })
  let sent = 0
  for (const coach of coaches) {
    const user = typeof coach.user === 'object' ? (coach.user as User | null) : null
    if (!user?.email) continue
    const day = await coachDay(p, user, coach, ymd, now).catch((e) => { p.logger.error({ err: e, msg: `Wrap-up for coach ${coach.id} failed` }); return null })
    if (!day?.items.length) continue
    const block = dueBlock(blocksOf(day.items), now)
    if (!block) continue
    // Once per block (unique marker per user + key)
    const key = `wrapup:${ymd}:${new Date(block.endsAt).getTime()}`
    const claimed = await p.create({ collection: 'seen-markers', overrideAccess: true, data: { user: user.id, key, at: now.toISOString() } }).then(() => true, () => false)
    if (!claimed) continue
    const att = day.attendanceToMark.length
    const sums = day.summaries.length
    if (!att && !sums) continue
    const parts = [att ? `mark attendance for ${att} session${att === 1 ? '' : 's'}` : null, sums ? `write ${sums} session summar${sums === 1 ? 'y' : 'ies'}` : null].filter(Boolean)
    const subject = `Wrap up today: ${parts.join(' and ')}`
    const url = `/coach/wrap-up?day=${ymd}`
    const rows: [string, string][] = [
      ...day.attendanceToMark.map((i) => [formatDate(i.startsAt, { hour: 'numeric', minute: '2-digit' }), `${i.label} — attendance`] as [string, string]),
      ...day.summaries.map((s) => [formatDate(s.at, { hour: 'numeric', minute: '2-digit' }), `${s.title} — summary`] as [string, string]),
    ]
    await sendEmail(p, {
      to: user.email,
      subject,
      html: emailLayout('academy', [{ heading: 'Thanks for today — time to wrap up', intro: `Hi ${user.firstName || coach.displayName} — a couple of minutes now: ${parts.join(' and ')}. Families get summaries straight away.`, rows, cta: { label: 'Wrap up today', href: `${siteUrl()}${url}` } }]),
      sender: 'academy',
      userId: user.id,
      push: { type: 'reminders', url, body: parts.join(' · ').replace(/^./, (c) => c.toUpperCase()), tag: `wrapup-${ymd}` },
    })
    sent++
  }
  return { sent }
}
