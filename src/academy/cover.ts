import type { Payload } from 'payload'
import type { AcademyCoach, AcademySession, AcademyTerm } from '@/payload-types'
import { localWeekdayTime } from '../lib/time'
import { formatDate } from '../lib/format'
import { emailLayout, esc } from '../lib/email-templates'
import { sendEmail } from '../lib/email'
import { siteUrl } from '../lib/payments'
import { academyBrand } from './brand'
import { isAway, toYmd } from './term-dates'

const id = (v: number | { id: number }) => (typeof v === 'object' ? v.id : v)

/** Upcoming live sessions for a coach within a term. */
export async function upcomingSessions(payload: Payload, coachId: number, term: Pick<AcademyTerm, 'endDate'>) {
  const { docs } = await payload.find({
    collection: 'academy-sessions',
    where: { coach: { equals: coachId }, status: { in: ['held', 'scheduled'] }, startsAt: { greater_than: new Date().toISOString(), less_than_equal: term.endDate } },
    sort: 'startsAt',
    depth: 1,
    limit: 2000,
    overrideAccess: true,
  })
  return docs
}

/** Booked sessions that fall on a weekly slot (weekday + time) — used to block removing booked times. */
export function sessionsOnSlot(sessions: AcademySession[], weekday: string, time: string) {
  return sessions.filter((s) => {
    const w = localWeekdayTime(s.startsAt)
    return w.weekday === weekday && w.time === time
  })
}

/**
 * Re-check every upcoming session for the coach against their away periods. Sessions on away days are
 * flagged `needsCover`; sessions no longer on away days are un-flagged (unless a cover coach is assigned).
 * Returns the sessions that were newly flagged.
 */
export async function syncCoverFlags(payload: Payload, coachId: number, term: AcademyTerm, away: { from: string; to: string }[]) {
  const sessions = await upcomingSessions(payload, coachId, term)
  const newlyFlagged: AcademySession[] = []
  for (const s of sessions) {
    const should = isAway(toYmd(s.startsAt), away)
    if (should && !s.needsCover) {
      await payload.update({ collection: 'academy-sessions', id: s.id, data: { needsCover: true }, overrideAccess: true })
      newlyFlagged.push(s)
    } else if (!should && s.needsCover && !s.coverCoach) {
      await payload.update({ collection: 'academy-sessions', id: s.id, data: { needsCover: false }, overrideAccess: true })
    }
  }
  return newlyFlagged
}

const when = (iso: string) => formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** Email the Academy admin a list of sessions that need a replacement coach. */
export async function alertCoverNeeded(payload: Payload, coach: AcademyCoach, sessions: AcademySession[], reason: string) {
  if (!sessions.length) return
  const rows = sessions.map((s) => {
    const b = typeof s.booking === 'object' ? s.booking : null
    return [when(s.startsAt), b ? `${b.player.firstName} ${b.player.lastName} (${b.reference})` : `Session ${s.id}`] as [string, string]
  })
  const html = emailLayout('academy', [
    {
      heading: `${sessions.length} session${sessions.length === 1 ? '' : 's'} need cover`,
      intro: `${esc(coach.displayName)} ${esc(reason)}. Please assign a replacement coach and make sure there’s a handover so the player’s progress continues.`,
      rows,
      cta: { label: 'Open sessions needing cover', href: `${siteUrl()}/management/academy#cover` },
    },
  ])
  await sendEmail(payload, { to: academyBrand.email, subject: `Cover needed: ${sessions.length} session${sessions.length === 1 ? '' : 's'} with ${coach.displayName}`, html, sender: 'academy' })
}

/** Alert the admin that a coach tried to remove a time families have booked. */
export async function alertBlockedRemoval(payload: Payload, coach: AcademyCoach, termName: string, blocked: { slot: string; sessions: AcademySession[] }[]) {
  const html = emailLayout('academy', [
    {
      heading: 'Coach tried to remove a booked time',
      intro: `${esc(coach.displayName)} tried to remove availability for ${esc(termName)} that families have already booked. The change was blocked — please follow up with the coach.`,
      rows: blocked.map((b) => [b.slot, `${b.sessions.length} booked session${b.sessions.length === 1 ? '' : 's'} from ${when(b.sessions[0].startsAt)}`] as [string, string]),
      cta: { label: 'Open Academy availability', href: `${siteUrl()}/management/academy` },
    },
  ])
  await sendEmail(payload, { to: academyBrand.email, subject: `Blocked change: ${coach.displayName} tried to remove booked times`, html, sender: 'academy' })
}

export { id as relId }
