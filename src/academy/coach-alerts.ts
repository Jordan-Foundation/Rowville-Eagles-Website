import type { Payload } from 'payload'
import type { AcademyBooking, AcademyCoach, AcademySession, User } from '@/payload-types'
import { emailLayout, esc } from '../lib/email-templates'
import { sendEmail } from '../lib/email'
import { formatDate } from '../lib/format'
import { siteUrl } from '../lib/payments'
import { sendSms } from '../lib/sms'
import { ageOn } from './session-view'

/**
 * Tell a coach about a new booking with them — ONE email and ONE text per booking, never one per
 * session: a 10-week term is a single message summarising the weekday, time and dates.
 * Texts carry the player's first name and initial only (Child Safe); full details are in the portal.
 */
const rel = (v: number | { id: number } | null | undefined) => (v && typeof v === 'object' ? v.id : (v ?? undefined))
const when = (iso: string) => formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const time = (iso: string) => formatDate(iso, { hour: 'numeric', minute: '2-digit' })
const day = (iso: string) => formatDate(iso, { day: 'numeric', month: 'short' })

export function bookingSummary(b: Pick<AcademyBooking, 'type' | 'weekday'>, sessions: Pick<AcademySession, 'startsAt'>[], opts: { makeUp?: boolean } = {}) {
  const first = sessions[0]?.startsAt
  if (!first) return ''
  if (opts.makeUp) return `make-up 1-on-1 ${when(first)}`
  if (b.type === 'casual' || sessions.length === 1) return `casual 1-on-1 ${when(first)}`
  return `${b.weekday ?? formatDate(first, { weekday: 'long' })}s ${time(first)}, ${sessions.length} sessions ${day(first)}–${day(sessions.at(-1)!.startsAt)}`
}

export async function alertCoachNewBooking(payload: Payload, booking: AcademyBooking, sessions: AcademySession[], opts: { coachId?: number; makeUp?: boolean } = {}) {
  const coach = (await payload.findByID({ collection: 'academy-coaches', id: opts.coachId ?? rel(booking.coach)!, depth: 1, overrideAccess: true })) as AcademyCoach
  const user = typeof coach.user === 'object' ? (coach.user as User) : null
  if (!user) return
  const p = booking.player
  const age = p.dateOfBirth ? ageOn(p.dateOfBirth) : null
  const summary = bookingSummary(booking, sessions, opts)
  const link = `${siteUrl()}/coach/sessions${sessions[0] ? `/${sessions[0].id}` : ''}`
  const heading = opts.makeUp ? 'Make-up session booked with you' : booking.type === 'term' ? 'New term booking' : 'New 1-on-1 booking'

  const html = emailLayout('academy', [
    {
      heading,
      intro: `${esc(p.firstName)} ${esc(p.lastName)}${age !== null ? ` (${age})` : ''} has booked ${esc(summary)} with you.`,
      rows: [
        ['Player', `${p.firstName} ${p.lastName}${age !== null ? `, age ${age}` : ''}`],
        ['Booked', summary],
        ...(p.goals ? ([['Goals', p.goals]] as [string, string][]) : []),
        ...(p.medical ? ([['Medical notes', 'Yes — check before the session']] as [string, string][]) : []),
        ['Parent / guardian', `${booking.contact.firstName} ${booking.contact.lastName}`],
        ['Reference', booking.reference],
      ],
      cta: { label: 'Open in the coach portal', href: link },
      after: 'Contact the parent or guardian only, through the Academy — never the player directly.',
    },
  ])
  await sendEmail(payload, { to: user.email, subject: `${heading}: ${p.firstName} — ${summary}`, html, sender: 'academy', userId: user.id })
  await sendSms(payload, {
    to: user.phone,
    kind: 'coach_alert',
    optedOut: user.smsOptOut,
    body: `Foundation Academy: ${heading.toLowerCase()} — ${p.firstName} ${p.lastName.charAt(0)}.${age !== null ? ` (${age})` : ''}, ${summary}. Details: ${link}`,
  })
}
