'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { hasRole } from '@/access'
import { localToUtc } from '@/lib/time'
import { cancelAcademy, goodwillCredit, loadForCancellation, quoteFor, retryRefund } from '@/academy/cancellations'
import type { CancelBy, Outcome, Quote } from '@/academy/cancellation'
import { applyReschedule, planReschedule, type RescheduleRequest } from '@/academy/reschedule-service'
import { WEEKDAYS, type Weekday } from '@/academy/constants'

async function staff() {
  const user = await currentUser()
  return user && hasRole(user, 'admin', 'committee') ? user : null
}

const scopeOf = (scope: string, ids: number[]): 'booking' | number[] => (scope === 'booking' ? 'booking' : ids)

/** Live policy quote while staff choose what to cancel. */
export async function previewCancellation(bookingId: number, scope: 'booking' | 'sessions', ids: number[], by: CancelBy): Promise<Quote | { error: string }> {
  if (!(await staff())) return { error: 'Management only.' }
  const data = await loadForCancellation(await payload(), bookingId)
  if (!data) return { error: 'Booking not found.' }
  return quoteFor(data, scopeOf(scope, ids), by)
}

export type StaffActionState = { error?: string; done?: string; warnings?: string[] }

export async function submitCancellation(_prev: StaffActionState, fd: FormData): Promise<StaffActionState> {
  const user = await staff()
  if (!user) return { error: 'Management only.' }
  const bookingId = Number(fd.get('bookingId'))
  const ids = String(fd.get('sessionIds') ?? '').split(',').map(Number).filter(Boolean)
  const outcome = String(fd.get('outcome') ?? '') as Outcome
  const amountRaw = String(fd.get('amount') ?? '').trim()
  const makeDate = String(fd.get('makeUpDate') ?? '')
  const makeTime = String(fd.get('makeUpTime') ?? '')
  const p = await payload()
  const res = await cancelAcademy(p, {
    bookingId,
    cancel: scopeOf(String(fd.get('scope')), ids),
    by: fd.get('by') === 'coach' ? 'coach' : 'family',
    outcome,
    overrideAmount: amountRaw === '' ? undefined : Number(amountRaw),
    overrideSessions: String(fd.get('creditSessions') ?? '').trim() === '' ? undefined : Number(fd.get('creditSessions')),
    reason: String(fd.get('reason') ?? ''),
    actorId: user.id,
    makeUp: outcome === 'makeup' && makeDate && makeTime ? { startsAt: localToUtc(makeDate, makeTime).toISOString(), coachId: Number(fd.get('makeUpCoach')) } : undefined,
    notify: fd.get('notify') === 'on',
  })
  if (!res.ok) return { error: res.error }
  revalidatePath(`/management/academy/bookings/${bookingId}`)
  const parts = [
    res.cash > 0 && `${res.refund === 'failed' ? 'Refund FAILED' : 'Refunded'} $${res.cash.toFixed(2)}${res.refund === 'simulated' ? ' (simulated)' : ''}`,
    res.creditSessions > 0 && `${res.creditSessions} session credit${res.creditSessions === 1 ? '' : 's'}`,
    outcome === 'makeup' && 'make-up booked',
  ].filter(Boolean)
  // Redirect so the result shows even when the booking closes (and the cancel panel disappears)
  const done = `Cancelled ${res.quote.sessionIds.length} session${res.quote.sessionIds.length === 1 ? '' : 's'}${parts.length ? ' · ' + parts.join(' · ') : ''}.`
  const qs = new URLSearchParams({ done, ...(res.warnings.length ? { warn: res.warnings.join('\n') } : {}) })
  redirect(`/management/academy/bookings/${bookingId}?${qs}`)
}

export async function submitRetryRefund(_prev: StaffActionState, fd: FormData): Promise<StaffActionState> {
  if (!(await staff())) return { error: 'Management only.' }
  const bookingId = Number(fd.get('bookingId'))
  const res = await retryRefund(await payload(), bookingId, String(fd.get('key')))
  revalidatePath(`/management/academy/bookings/${bookingId}`)
  if (!res.ok) return { error: res.error }
  redirect(`/management/academy/bookings/${bookingId}?${new URLSearchParams({ done: 'Refund sent to the family’s card.' })}`)
}

export async function submitGoodwill(_prev: StaffActionState, fd: FormData): Promise<StaffActionState> {
  const user = await staff()
  if (!user) return { error: 'Management only.' }
  const bookingId = Number(fd.get('bookingId'))
  const res = await goodwillCredit(await payload(), { bookingId, sessions: Number(fd.get('sessions')), reason: String(fd.get('reason') ?? ''), actorId: user.id })
  revalidatePath(`/management/academy/bookings/${bookingId}`)
  return res.ok ? { done: 'Session credits added.' } : { error: res.error }
}

// ── Rescheduling ─────────────────────────────────────────────────────────────

export type ReschedulePreview = { moves: { sessionId: number; from: string; to: string; coach: string }[]; errors: string[]; warnings: string[] } | { error: string }

function rescheduleRequest(bookingId: number, f: Record<string, string>): RescheduleRequest | { error: string } {
  const coachId = Number(f.coach)
  if (!coachId) return { error: 'Choose a coach.' }
  if (f.kind === 'term') {
    if (!WEEKDAYS.includes(f.weekday as Weekday)) return { error: 'Choose the new day.' }
    return { bookingId, kind: 'term', fromSessionId: Number(f.fromSession), weekday: f.weekday as Weekday, time: f.time, coachId }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date ?? '') || !/^\d{2}:\d{2}$/.test(f.time ?? '')) return { error: 'Choose the new date and time.' }
  return { bookingId, kind: 'session', sessionId: Number(f.session), startsAt: localToUtc(f.date, f.time).toISOString(), coachId }
}

export async function previewReschedule(bookingId: number, f: Record<string, string>): Promise<ReschedulePreview> {
  if (!(await staff())) return { error: 'Management only.' }
  const req = rescheduleRequest(bookingId, f)
  if ('error' in req) return req
  const p = await payload()
  const plan = await planReschedule(p, req)
  if ('error' in plan) return { error: plan.error as string }
  const { docs: coaches } = await p.find({ collection: 'academy-coaches', where: { id: { in: [...new Set(plan.moves.map((m) => m.coachId))] } }, depth: 0, limit: 20, overrideAccess: true })
  return { moves: plan.moves.map((m) => ({ sessionId: m.sessionId, from: m.from, to: m.to, coach: coaches.find((c) => c.id === m.coachId)?.displayName ?? '' })), errors: plan.errors, warnings: plan.warnings }
}

export async function submitReschedule(_prev: StaffActionState, fd: FormData): Promise<StaffActionState> {
  const user = await staff()
  if (!user) return { error: 'Management only.' }
  const bookingId = Number(fd.get('bookingId'))
  const f = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]))
  const req = rescheduleRequest(bookingId, f)
  if ('error' in req) return { error: req.error }
  const res = await applyReschedule(await payload(), { ...req, reason: f.reason ?? '', actorId: user.id, notify: fd.get('notify') === 'on' })
  if (!res.ok) return { error: res.error }
  const qs = new URLSearchParams({ done: `Moved ${res.moved} session${res.moved === 1 ? '' : 's'}.${fd.get('notify') === 'on' ? ' The family and coach have been emailed.' : ''}`, ...(res.warnings.length ? { warn: res.warnings.join('\n') } : {}) })
  redirect(`/management/academy/bookings/${bookingId}?${qs}`)
}
