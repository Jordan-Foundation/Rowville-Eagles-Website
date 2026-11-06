import type { AcademyBooking, AcademySession } from '@/payload-types'
import { formatAUD, formatDate } from '../lib/format'

/** Payment status of one session, in words, for families, coaches and staff. */
export function sessionPayment(s: Pick<AcademySession, 'paid' | 'startsAt'>, b: Pick<AcademyBooking, 'paymentMode' | 'type' | 'status' | 'amount' | 'sessionsTotal'>) {
  if (b.paymentMode !== 'weekly') return { label: b.type === 'term' ? 'Term paid in full' : 'Paid', tone: 'ok' as const }
  if (s.paid) return { label: 'Paid (weekly plan)', tone: 'ok' as const }
  if (b.status === 'payment_failed') return { label: 'Payment overdue', tone: 'bad' as const }
  const charge = new Date(new Date(s.startsAt).getTime() - 48 * 3600_000).toISOString()
  return { label: `${formatAUD(b.amount / (b.sessionsTotal || 1))} charged ${formatDate(charge, { weekday: 'short', day: 'numeric', month: 'short' })}`, tone: 'pending' as const }
}

/** Whole years old on a given date. */
export function ageOn(dob: string, at = new Date()) {
  const d = new Date(dob)
  let age = at.getFullYear() - d.getFullYear()
  const m = at.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && at.getDate() < d.getDate())) age--
  return age
}

/** Coaches may mark attendance from 15 minutes before the start. */
export const canMarkAttendance = (startsAt: string, now = new Date()) => new Date(startsAt).getTime() - 15 * 60_000 <= now.getTime()

const rel = (v: number | { id: number } | null | undefined) => (v && typeof v === 'object' ? v.id : (v ?? null))

/** Is this coach running the session — the booked coach (unless someone is covering) or the cover coach? */
export function coachRole(s: Pick<AcademySession, 'coach' | 'coverCoach' | 'needsCover'>, coachId: number): 'coach' | 'cover' | 'covered' | null {
  if (rel(s.coverCoach) === coachId) return 'cover'
  if (rel(s.coach) === coachId) return s.needsCover && rel(s.coverCoach) ? 'covered' : 'coach'
  return null
}
