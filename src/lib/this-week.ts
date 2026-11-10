import type { Payload } from 'payload'
import { localToUtc, localYmd } from './time'
import { slotSessions } from '../academy/terms/slots'
import { campDayList } from './camps'
import type { Program } from '@/payload-types'

const q = { overrideAccess: true, pagination: false } as const

/** Monday–Sunday of the current week (local dates). */
export function weekRange(now = new Date()) {
  const today = localYmd(now)
  const d = new Date(`${today}T00:00:00Z`)
  const mon = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000)
  const sun = new Date(mon.getTime() + 6 * 86_400_000)
  const ymd = (x: Date) => x.toISOString().slice(0, 10)
  return { from: ymd(mon), to: ymd(sun), start: localToUtc(ymd(mon), '00:00'), end: localToUtc(ymd(sun), '23:59') }
}

export type WeekLine = { label: string; value: string; href?: string; tone?: 'good' | 'warn' }

/** The Management dashboard's "This week" panel: what's on, what came in, what needs doing. */
export async function managementThisWeek(p: Payload, now = new Date()): Promise<{ from: string; to: string; lines: WeekLine[] }> {
  const w = weekRange(now)
  const lastWeek = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  const between = { greater_than_equal: w.start.toISOString(), less_than_equal: w.end.toISOString() }
  const [ones, smallGroups, needCover, programs, newOnes, newBookings, cancels, trials, camps, orders, paid1, paid2] = await Promise.all([
    p.count({ collection: 'academy-sessions', where: { status: { in: ['scheduled', 'completed', 'no_show'] }, kind: { equals: 'one-on-one' }, startsAt: between }, overrideAccess: true }),
    // One per small group session (its time row), however many players are in it
    p.count({ collection: 'academy-sessions', where: { status: { equals: 'scheduled' }, kind: { equals: 'group-slot' }, startsAt: between }, overrideAccess: true }),
    p.count({ collection: 'academy-sessions', where: { needsCover: { equals: true }, coverCoach: { exists: false }, status: { equals: 'scheduled' }, startsAt: between }, overrideAccess: true }),
    p.find({ ...q, collection: 'programs', where: { type: { in: ['academy-term', 'toddler'] }, status: { in: ['open', 'full'] } }, limit: 30, depth: 0 }),
    p.count({ collection: 'academy-bookings', where: { status: { in: ['confirmed', 'completed'] }, createdAt: { greater_than: lastWeek } }, overrideAccess: true }),
    p.count({ collection: 'bookings', where: { status: { equals: 'paid' }, bookingType: { not_equals: 'trial' }, createdAt: { greater_than: lastWeek } }, overrideAccess: true }),
    p.count({ collection: 'academy-sessions', where: { status: { equals: 'cancelled' }, cancelledAt: { greater_than: lastWeek } }, overrideAccess: true }),
    p.count({ collection: 'bookings', where: { bookingType: { equals: 'trial' }, status: { equals: 'paid' }, sessionStart: between }, overrideAccess: true }),
    // Camps running at any point this week
    p.find({ ...q, collection: 'programs', where: { type: { equals: 'holiday-camp' }, status: { in: ['open', 'full', 'closed'] }, startDate: { less_than_equal: w.end.toISOString() }, endDate: { greater_than_equal: w.start.toISOString() } }, limit: 10, depth: 0 }),
    p.count({ collection: 'orders', where: { status: { equals: 'paid' } }, overrideAccess: true }),
    p.find({ ...q, collection: 'academy-bookings', where: { status: { in: ['confirmed', 'completed'] }, createdAt: { greater_than: lastWeek } }, limit: 1000, depth: 0, select: { amount: true, creditApplied: true, paymentMode: true, sessionsTotal: true } }),
    p.find({ ...q, collection: 'bookings', where: { status: { equals: 'paid' }, createdAt: { greater_than: lastWeek } }, limit: 1000, depth: 0, select: { amount: true } }),
  ])
  // Group training sessions this week across open Academy terms / Mini Ballers
  let groupSessions = 0
  if (programs.docs.length) {
    const { docs: slots } = await p.find({ ...q, collection: 'academy-term-slots', where: { program: { in: programs.docs.map((x) => x.id) }, active: { not_equals: false } }, limit: 300, depth: 0 })
    for (const s of slots) {
      const prog = programs.docs.find((x) => x.id === (typeof s.program === 'object' ? s.program.id : s.program)) as Program | undefined
      if (prog) groupSessions += slotSessions(s, prog).filter((x) => !x.cancelled && x.date >= w.from && x.date <= w.to).length
    }
  }
  const money = paid1.docs.reduce((n, b) => n + (b.paymentMode === 'weekly' ? b.amount / (b.sessionsTotal || 1) : b.amount - (b.creditApplied ?? 0)), 0) + paid2.docs.reduce((n, b) => n + (b.amount ?? 0), 0)
  const aud = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n)
  // Camps running this week: days this week and children booked
  const campLines: WeekLine[] = []
  for (const c of camps.docs) {
    const days = campDayList(c).filter((d) => d.date >= w.from && d.date <= w.to)
    if (!days.length) continue
    const kids = (await p.count({ collection: 'bookings', where: { program: { equals: c.id }, status: { equals: 'paid' } }, overrideAccess: true })).totalDocs
    campLines.push({ label: `Camp this week: ${c.title}`, value: `${days.length} day${days.length === 1 ? '' : 's'} · ${kids} kids`, href: `/management/camps/${c.id}` })
  }
  return {
    from: w.from,
    to: w.to,
    lines: [
      { label: '1-on-1 sessions', value: String(ones.totalDocs), href: '/management/academy/dashboard' },
      ...(smallGroups.totalDocs ? [{ label: 'Small group sessions', value: String(smallGroups.totalDocs), href: '/management/programs?program=1on1&kind=group' }] : []),
      { label: 'Group trainings', value: String(groupSessions), href: '/management/academy/terms' },
      { label: 'Trial sessions booked', value: String(trials.totalDocs), href: '/management/programs' },
      ...campLines,
      { label: 'New bookings (last 7 days)', value: String(newOnes.totalDocs + newBookings.totalDocs), href: '/management/academy/bookings', tone: 'good' as const },
      { label: 'Money in (last 7 days)', value: aud(money), href: '/management/programs', tone: 'good' as const },
      { label: 'Cancellations (last 7 days)', value: String(cancels.totalDocs), href: '/management/academy/bookings' },
      ...(needCover.totalDocs ? [{ label: 'Sessions this week needing cover', value: String(needCover.totalDocs), href: '/management/academy#cover', tone: 'warn' as const }] : []),
      ...(orders.totalDocs ? [{ label: 'Shop orders to fulfil', value: String(orders.totalDocs), href: '/management/store', tone: 'warn' as const }] : []),
    ],
  }
}
