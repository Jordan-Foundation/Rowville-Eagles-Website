import { randomBytes } from 'crypto'
import type { Payload } from 'payload'
import { commitTransaction, createLocalReq, initTransaction, killTransaction } from 'payload'
import type { AcademyBooking, AcademyCoach, User } from '@/payload-types'
import { emailLayout, esc } from '../lib/email-templates'
import { sendEmail } from '../lib/email'
import { formatDate } from '../lib/format'
import { siteUrl } from '../lib/payments'
import { sendSms } from '../lib/sms'
import { localWeekdayTime } from '../lib/time'
import { academyBrand } from './brand'
import type { Weekday } from './constants'
import { checkMoves, planTermMove, type CoachAvailabilityLite, type Move } from './reschedule'
import { isAway, toYmd } from './term-dates'

/**
 * Staff rescheduling: move one session, or the rest of a term, to a new day/time (and optionally coach).
 * Price, payment status, weekly charges and credits are untouched. Families and every affected coach
 * get ONE message each, listing old → new times.
 */

const rel = (v: number | { id: number } | null | undefined) => (v && typeof v === 'object' ? v.id : (v ?? undefined))
const when = (iso: string) => formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export type RescheduleRequest =
  | { bookingId: number; kind: 'session'; sessionId: number; startsAt: string; coachId: number }
  | { bookingId: number; kind: 'term'; fromSessionId: number; weekday: Weekday; time: string; coachId: number }

async function load(payload: Payload, bookingId: number) {
  const booking = await payload.findByID({ collection: 'academy-bookings', id: bookingId, depth: 0, overrideAccess: true, disableErrors: true })
  if (!booking) return null
  const [{ docs: sessions }, term] = await Promise.all([
    payload.find({ collection: 'academy-sessions', where: { booking: { equals: bookingId } }, sort: 'startsAt', limit: 100, depth: 0, overrideAccess: true }),
    payload.findByID({ collection: 'academy-terms', id: rel(booking.term)!, depth: 0, overrideAccess: true }),
  ])
  return { booking, sessions, term }
}

/** Work out the moves and check them — used for the preview and again when saving. */
export async function planReschedule(payload: Payload, r: RescheduleRequest, now = new Date()) {
  const data = await load(payload, r.bookingId)
  if (!data) return { error: 'Booking not found.' as const }
  const { booking, sessions, term } = data
  if (!['confirmed', 'payment_failed'].includes(booking.status)) return { error: `This booking is ${booking.status.replace('_', ' ')} — nothing to reschedule.` as const }
  const upcoming = sessions.filter((s) => s.status === 'scheduled' && new Date(s.startsAt).getTime() > now.getTime())
  let moves: Move[]
  if (r.kind === 'session') {
    const s = upcoming.find((x) => x.id === r.sessionId)
    if (!s) return { error: 'Choose an upcoming session — sessions that have started can’t be moved.' as const }
    if (Number.isNaN(Date.parse(r.startsAt))) return { error: 'Choose the new date and time.' as const }
    moves = [{ sessionId: s.id, from: s.startsAt, to: new Date(r.startsAt).toISOString(), coachId: r.coachId }]
  } else {
    if (booking.type !== 'term') return { error: 'Only term bookings can be moved week by week.' as const }
    const fromIdx = upcoming.findIndex((x) => x.id === r.fromSessionId)
    if (fromIdx < 0) return { error: 'Choose the first upcoming session to move.' as const }
    if (!/^\d{2}:\d{2}$/.test(r.time)) return { error: 'Choose the new time.' as const }
    moves = planTermMove({ sessions: upcoming.slice(fromIdx).map((s) => ({ id: s.id, startsAt: s.startsAt, coachId: rel(s.coach)! })), weekday: r.weekday, time: r.time, coachId: r.coachId })
  }
  moves = moves.filter((m) => m.from !== m.to || m.coachId !== rel(sessions.find((s) => s.id === m.sessionId)!.coach))
  if (!moves.length) return { error: 'Nothing changes — pick a different day, time or coach.' as const }

  const coachIds = [...new Set(moves.map((m) => m.coachId))]
  const [{ docs: avail }, { docs: taken }] = await Promise.all([
    payload.find({ collection: 'academy-availability', where: { term: { equals: term.id }, coach: { in: coachIds } }, depth: 0, limit: 50, overrideAccess: true }),
    payload.find({
      collection: 'academy-sessions',
      where: { coach: { in: coachIds }, status: { not_equals: 'cancelled' }, startsAt: { in: moves.map((m) => m.to) } },
      depth: 0,
      limit: 500,
      overrideAccess: true,
      select: { coach: true, startsAt: true },
    }),
  ])
  const availability: CoachAvailabilityLite[] = avail.map((a) => ({
    coachId: rel(a.coach)!,
    slots: (a.slots ?? []).map((s) => ({ weekday: s.weekday, startTime: s.startTime })),
    away: (a.awayPeriods ?? []).map((w) => ({ from: w.from, to: w.to })),
  }))
  const check = checkMoves(moves, { now, termEnd: term.endDate, availability, taken: taken.map((t) => ({ coachId: rel(t.coach)!, startsAt: t.startsAt, sessionId: t.id })) })
  if (booking.paymentMode === 'weekly' && r.kind === 'term') check.warnings.push('Weekly payments keep their current charge dates; check they still fall before each session.')
  return { booking, term, moves, availability, ...check }
}

export async function applyReschedule(payload: Payload, r: RescheduleRequest & { reason: string; actorId: number; notify?: boolean }) {
  if (!r.reason.trim()) return { ok: false as const, error: 'Please give a reason — it’s kept on the booking.' }
  const plan = await planReschedule(payload, r)
  if ('error' in plan) return { ok: false as const, error: plan.error as string }
  if (plan.errors.length) return { ok: false as const, error: plan.errors.join(' ') }
  const { booking, moves, availability } = plan

  const req = await createLocalReq({}, payload)
  await initTransaction(req)
  try {
    // Two steps, so sessions can move onto times other sessions in this booking are leaving
    for (const [i, m] of moves.entries()) {
      await payload.update({ collection: 'academy-sessions', id: m.sessionId, overrideAccess: true, req, data: { startsAt: new Date(Date.parse(m.from) + 3650 * 86_400_000 + i * 60_000).toISOString() } })
    }
    for (const m of moves) {
      const away = availability.find((a) => a.coachId === m.coachId)?.away ?? []
      const needsCover = isAway(toYmd(m.to), away)
      await payload.update({
        collection: 'academy-sessions',
        id: m.sessionId,
        overrideAccess: true,
        req,
        data: { startsAt: m.to, coach: m.coachId, needsCover, ...(needsCover ? {} : { coverCoach: null }), reminderSentAt: null },
      })
    }
    const { docs: all } = await payload.find({ collection: 'academy-sessions', where: { booking: { equals: booking.id }, status: { not_equals: 'cancelled' } }, sort: 'startsAt', limit: 100, depth: 0, overrideAccess: true, req })
    const slot = r.kind === 'term' ? localWeekdayTime(moves[0].to) : null
    await payload.update({
      collection: 'academy-bookings',
      id: booking.id,
      overrideAccess: true,
      req,
      data: {
        firstSessionAt: all[0]?.startsAt ?? booking.firstSessionAt,
        ...(slot ? { weekday: slot.weekday as Weekday, startTime: slot.time } : {}),
        ...(r.kind === 'term' && r.coachId !== rel(booking.coach) && moves.length === all.filter((s) => new Date(s.startsAt) > new Date()).length ? { coach: r.coachId } : {}),
        adjustments: [
          ...(booking.adjustments ?? []),
          {
            key: randomBytes(6).toString('hex'),
            action: 'reschedule',
            by: 'admin',
            outcome: 'none',
            cash: 0,
            refundStatus: 'none',
            sessions: moves.map((m) => `${when(m.from)} → ${when(m.to)}`).join('; '),
            rule: r.kind === 'term' ? `Rest of term moved to ${r.weekday}s ${r.time}` : 'One session moved',
            reason: r.reason,
            actor: r.actorId,
            at: new Date().toISOString(),
          },
        ],
      },
    })
    await commitTransaction(req)
  } catch (e) {
    await killTransaction(req)
    const msg = String((e as Error)?.message ?? e) + String((e as { cause?: unknown })?.cause ?? '')
    if (/coach_id|starts_at|unique|duplicate|23505/i.test(msg)) return { ok: false as const, error: 'One of the new times was just taken by another booking. Check the preview and try again.' }
    throw e
  }

  if (r.notify !== false) {
    try {
      await notifyReschedule(payload, booking, moves, r.reason)
    } catch (e) {
      payload.logger.error({ err: e, msg: `Reschedule emails failed for ${booking.reference}` })
    }
  }
  return { ok: true as const, moved: moves.length, warnings: plan.warnings }
}

async function notifyReschedule(payload: Payload, booking: AcademyBooking, moves: Move[], reason: string) {
  const list = moves.map((m) => `${when(m.from)} → <strong>${when(m.to)}</strong>`).join('<br>')
  const coachIds = [...new Set([rel(booking.coach)!, ...moves.map((m) => m.coachId)])]
  const coaches = await Promise.all(coachIds.map((id) => payload.findByID({ collection: 'academy-coaches', id, depth: 1, overrideAccess: true }) as Promise<AcademyCoach>))
  const name = (id: number) => coaches.find((c) => c.id === id)?.displayName ?? 'your coach'
  const newCoach = moves.some((m) => m.coachId !== rel(booking.coach)) ? [...new Set(moves.map((m) => name(m.coachId)))].join(', ') : null

  const html = emailLayout('academy', [
    {
      heading: moves.length === 1 ? 'Session time changed' : 'Your session times have changed',
      intro: `Hi ${esc(booking.contact.firstName)}, ${esc(booking.player.firstName)}’s ${moves.length === 1 ? 'session has' : `${moves.length} sessions have`} moved${newCoach ? ` and will be with ${esc(newCoach)}` : ''}. Nothing changes with your payment.`,
      after: `${list}<br><br>Can’t make the new ${moves.length === 1 ? 'time' : 'times'}? Reply to this email or call ${esc(academyBrand.phone)}.`,
      rows: [['Player', `${booking.player.firstName} ${booking.player.lastName}`], ['Reference', booking.reference]],
      cta: { label: 'View booking', href: `${siteUrl()}/account/bookings/${booking.reference}` },
    },
  ])
  await sendEmail(payload, { to: booking.contact.email, subject: `New ${moves.length === 1 ? 'time' : 'times'}: ${booking.player.firstName}’s 1-on-1${moves.length === 1 ? '' : 's'}`, html, sender: 'academy', userId: rel(booking.account) })

  // One message to each coach affected (losing or gaining sessions)
  for (const c of coaches) {
    const theirs = moves.filter((m) => m.coachId === c.id || rel(booking.coach) === c.id)
    const user = typeof c.user === 'object' ? (c.user as User) : null
    if (!theirs.length || !user) continue
    const gaining = theirs.filter((m) => m.coachId === c.id)
    const losing = rel(booking.coach) === c.id ? theirs.filter((m) => m.coachId !== c.id) : []
    const lines = [
      ...gaining.map((m) => `${when(m.from)} → <strong>${when(m.to)}</strong>`),
      ...losing.map((m) => `${when(m.from)} — moved to ${esc(name(m.coachId))}`),
    ].join('<br>')
    const coachHtml = emailLayout('academy', [
      {
        heading: 'Session times changed',
        intro: `${esc(booking.player.firstName)} ${esc(booking.player.lastName)} (${esc(booking.reference)}): ${theirs.length} session${theirs.length === 1 ? '' : 's'} changed. Reason: ${esc(reason)}.`,
        after: lines,
        cta: { label: 'Open my sessions', href: `${siteUrl()}/coach/sessions` },
      },
    ])
    await sendEmail(payload, { to: user.email, subject: `Rescheduled: ${booking.player.firstName} — ${theirs.length} session${theirs.length === 1 ? '' : 's'}`, html: coachHtml, sender: 'academy', userId: user.id })
    const first = gaining[0] ?? losing[0]
    await sendSms(payload, {
      to: user.phone,
      kind: 'coach_alert',
      optedOut: user.smsOptOut,
      body: `Foundation Academy: rescheduled — ${booking.player.firstName} ${booking.player.lastName.charAt(0)}., ${when(first.from)} → ${gaining.includes(first) ? when(first.to) : `moved to ${name(first.coachId)}`}${theirs.length > 1 ? ` (+${theirs.length - 1} more)` : ''}. ${siteUrl()}/coach/sessions`,
    })
  }
}
