'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { hasRole } from '@/access'
import { localToUtc } from '@/lib/time'
import { cancelAcademy, goodwillCredit, loadForCancellation, quoteFor, retryRefund } from '@/academy/cancellations'
import type { CancelBy, Outcome, Quote } from '@/academy/cancellation'

async function staff() {
  const user = await currentUser()
  return user && hasRole(user, 'admin', 'committee') ? user : null
}

const scopeOf = (scope: string, ids: number[]): 'booking' | number[] => (scope === 'booking' ? 'booking' : ids)

/** Live policy quote while staff choose what to cancel. */
export async function previewCancellation(bookingId: number, scope: 'booking' | 'sessions', ids: number[], by: CancelBy): Promise<Quote | { error: string }> {
  if (!(await staff())) return { error: 'Staff only.' }
  const data = await loadForCancellation(await payload(), bookingId)
  if (!data) return { error: 'Booking not found.' }
  return quoteFor(data, scopeOf(scope, ids), by)
}

export type StaffActionState = { error?: string; done?: string; warnings?: string[] }

export async function submitCancellation(_prev: StaffActionState, fd: FormData): Promise<StaffActionState> {
  const user = await staff()
  if (!user) return { error: 'Staff only.' }
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
    reason: String(fd.get('reason') ?? ''),
    actorId: user.id,
    makeUp: outcome === 'makeup' && makeDate && makeTime ? { startsAt: localToUtc(makeDate, makeTime).toISOString(), coachId: Number(fd.get('makeUpCoach')) } : undefined,
    notify: fd.get('notify') === 'on',
  })
  if (!res.ok) return { error: res.error }
  revalidatePath(`/staff/academy/bookings/${bookingId}`)
  const parts = [
    res.cash > 0 && `${res.refund === 'failed' ? 'Refund FAILED' : 'Refunded'} $${res.cash.toFixed(2)}${res.refund === 'simulated' ? ' (simulated)' : ''}`,
    res.credit > 0 && `credit $${res.credit.toFixed(2)}`,
    outcome === 'makeup' && 'make-up booked',
  ].filter(Boolean)
  // Redirect so the result shows even when the booking closes (and the cancel panel disappears)
  const done = `Cancelled ${res.quote.sessionIds.length} session${res.quote.sessionIds.length === 1 ? '' : 's'}${parts.length ? ' · ' + parts.join(' · ') : ''}.`
  const qs = new URLSearchParams({ done, ...(res.warnings.length ? { warn: res.warnings.join('\n') } : {}) })
  redirect(`/staff/academy/bookings/${bookingId}?${qs}`)
}

export async function submitRetryRefund(_prev: StaffActionState, fd: FormData): Promise<StaffActionState> {
  if (!(await staff())) return { error: 'Staff only.' }
  const bookingId = Number(fd.get('bookingId'))
  const res = await retryRefund(await payload(), bookingId, String(fd.get('key')))
  revalidatePath(`/staff/academy/bookings/${bookingId}`)
  if (!res.ok) return { error: res.error }
  redirect(`/staff/academy/bookings/${bookingId}?${new URLSearchParams({ done: 'Refund sent to the family’s card.' })}`)
}

export async function submitGoodwill(_prev: StaffActionState, fd: FormData): Promise<StaffActionState> {
  const user = await staff()
  if (!user) return { error: 'Staff only.' }
  const bookingId = Number(fd.get('bookingId'))
  const res = await goodwillCredit(await payload(), { bookingId, amount: Number(fd.get('amount')), reason: String(fd.get('reason') ?? ''), actorId: user.id })
  revalidatePath(`/staff/academy/bookings/${bookingId}`)
  return res.ok ? { done: 'Credit added.' } : { error: res.error }
}
