'use server'

import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { coachOrNull } from '@/academy/portal'
import { canMarkAttendance, coachRole } from '@/academy/session-view'

export type CoachSessionState = { error?: string; saved?: string }

async function ownSession(id: number) {
  const me = await coachOrNull()
  if (!me) return { error: 'Please log in to the coach portal again.' } as const
  const p = await payload()
  const s = await p.findByID({ collection: 'academy-sessions', id, depth: 0, overrideAccess: true, disableErrors: true })
  const role = s ? coachRole(s, me.coach.id) : null
  // The booked coach can't mark a session someone else is covering
  if (!s || !role || role === 'covered' || s.status === 'held' || s.status === 'cancelled') return { error: 'You can only update sessions you run.' } as const
  return { p, s, me } as const
}

export async function markAttendance(_prev: CoachSessionState, fd: FormData): Promise<CoachSessionState> {
  const id = Number(fd.get('id'))
  const status = String(fd.get('status'))
  if (status !== 'completed' && status !== 'no_show' && status !== 'scheduled') return { error: 'Unknown attendance.' }
  const own = await ownSession(id)
  if ('error' in own) return { error: own.error }
  const { p, s, me } = own
  if (!canMarkAttendance(s.startsAt)) return { error: 'You can mark attendance from 15 minutes before the session.' }
  await p.update({
    collection: 'academy-sessions',
    id,
    overrideAccess: true,
    data: { status: status as 'completed' | 'no_show' | 'scheduled', attendanceBy: status === 'scheduled' ? null : me.user.id, attendanceAt: status === 'scheduled' ? null : new Date().toISOString() },
  })
  // Booking is completed once none of its sessions are still to come
  const bookingId = typeof s.booking === 'object' ? s.booking.id : s.booking
  const { totalDocs: open } = await p.count({ collection: 'academy-sessions', where: { booking: { equals: bookingId }, status: { in: ['held', 'scheduled'] } }, overrideAccess: true })
  const booking = await p.findByID({ collection: 'academy-bookings', id: bookingId, depth: 0, overrideAccess: true })
  if (open === 0 && booking.status === 'confirmed') await p.update({ collection: 'academy-bookings', id: bookingId, data: { status: 'completed' }, overrideAccess: true })
  if (open > 0 && booking.status === 'completed') await p.update({ collection: 'academy-bookings', id: bookingId, data: { status: 'confirmed' }, overrideAccess: true })
  revalidatePath('/coach/sessions')
  return { saved: status === 'completed' ? 'Marked as attended.' : status === 'no_show' ? 'Marked as a no-show.' : 'Attendance cleared.' }
}

export async function saveCoachNotes(_prev: CoachSessionState, fd: FormData): Promise<CoachSessionState> {
  const own = await ownSession(Number(fd.get('id')))
  if ('error' in own) return { error: own.error }
  await own.p.update({ collection: 'academy-sessions', id: own.s.id, overrideAccess: true, data: { coachNotes: String(fd.get('notes') ?? '').slice(0, 5000) } })
  return { saved: 'Notes saved.' }
}

/** "Running late": tell the family by text (or email), in their conversation so replies come back. */
export async function runningLate(_prev: CoachSessionState, fd: FormData): Promise<CoachSessionState> {
  const own = await ownSession(Number(fd.get('id')))
  if ('error' in own) return { error: own.error }
  const { p, s, me } = own
  const mins = [5, 10, 15, 20].includes(Number(fd.get('minutes'))) ? Number(fd.get('minutes')) : 10
  if (new Date(s.startsAt).getTime() < Date.now() - 60 * 60_000) return { error: 'This session has already finished.' }
  const booking = await p.findByID({ collection: 'academy-bookings', id: typeof s.booking === 'object' ? s.booking.id : s.booking, depth: 0, overrideAccess: true })
  const accountId = typeof booking.account === 'object' ? booking.account?.id : booking.account
  if (!accountId) return { error: 'This family has no account to message — please call them.' }
  const { conversationFor, staffReply } = await import('@/messaging/service')
  const account = await p.findByID({ collection: 'users', id: accountId, depth: 0, overrideAccess: true })
  const conv = await conversationFor(p, { account })
  const r = await staffReply(p, { user: me.user, side: 'coach', coach: me.coach }, conv.id, `Hi ${booking.contact.firstName}, I’m running about ${mins} minutes late for ${booking.player.firstName}’s session — sorry! See you soon.`)
  return r.delivery === 'failed' ? { error: 'Couldn’t reach the family — please call them.' } : { saved: `Family told you’re ${mins} minutes late (${r.delivery === 'sms' ? 'texted' : 'emailed'}).` }
}

/** "Need cover": flag the session for Management to find a cover coach, with a handover note. */
export async function needCover(_prev: CoachSessionState, fd: FormData): Promise<CoachSessionState> {
  const own = await ownSession(Number(fd.get('id')))
  if ('error' in own) return { error: own.error }
  const { p, s, me } = own
  if (coachRole(s, me.coach.id) !== 'coach') return { error: 'Only the booked coach can ask for cover.' }
  if (new Date(s.startsAt) < new Date()) return { error: 'This session has already started.' }
  const reason = String(fd.get('reason') ?? '').trim().slice(0, 1000)
  const handover = String(fd.get('handover') ?? '').trim().slice(0, 2000)
  await p.update({ collection: 'academy-sessions', id: s.id, overrideAccess: true, data: { needsCover: true, coverNote: [handover, reason && `(Reason: ${reason})`].filter(Boolean).join('\n') || s.coverNote } })
  const { sendEmail } = await import('@/lib/email')
  const { emailLayout, esc } = await import('@/lib/email-templates')
  const { academyBrand } = await import('@/academy/brand')
  const { siteUrl } = await import('@/lib/payments')
  const { formatDate } = await import('@/lib/format')
  await sendEmail(p, {
    to: academyBrand.email,
    subject: `Cover needed: ${me.coach.displayName}, ${formatDate(s.startsAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`,
    html: emailLayout('academy', [{ heading: 'A coach needs cover', intro: `${esc(me.coach.displayName)} can’t take this 1-on-1.${reason ? `<br><br>Reason: ${esc(reason)}` : ''}`, rows: [['When', formatDate(s.startsAt, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })]], cta: { label: 'Find a cover coach', href: `${siteUrl()}/management/academy` } }]),
    sender: 'academy',
  })
  revalidatePath(`/coach/sessions/${s.id}`)
  return { saved: 'Management has been asked to find cover. You’ll see it here once someone is assigned.' }
}
