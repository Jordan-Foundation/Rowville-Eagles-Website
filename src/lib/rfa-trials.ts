import type { Payload } from 'payload'
import type { Program } from '@/payload-types'
import { datesOnWeekday, localToUtc, localYmd } from './time'
import { formatDate } from './format'

/** `remaining` is keyed by year of birth (as a string) */
export type TrialNight = { start: string; label: string; birthYears: number[]; remaining: Record<string, number> }

/** The Academy term currently running (or the next one to start) that has weekly nights set. */
export async function currentAcademyTerm(payload: Payload): Promise<Program | undefined> {
  const now = new Date().toISOString()
  const { docs } = await payload.find({
    collection: 'programs',
    where: { type: { equals: 'academy-term' }, status: { in: ['open', 'full'] }, or: [{ endDate: { greater_than: now } }, { endDate: { exists: false } }] },
    sort: 'startDate',
    limit: 10,
    depth: 0,
  })
  return docs.find((d) => (d.weeklySessions?.length ?? 0) > 0)
}

/** Every upcoming night of the term, with trial spots left per age group. */
export async function trialNights(payload: Payload, term: Program): Promise<TrialNight[]> {
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000)
  const from = localYmd(term.startDate && new Date(term.startDate) > tomorrow ? new Date(term.startDate) : tomorrow)
  const to = localYmd(term.endDate ? new Date(term.endDate) : new Date(Date.now() + 70 * 24 * 3600 * 1000))

  // Count existing trial bookings in one query
  const holdCutoff = new Date(Date.now() - 35 * 60 * 1000).toISOString()
  const { docs: taken } = await payload.find({
    collection: 'bookings',
    where: {
      program: { equals: term.id },
      bookingType: { equals: 'trial' },
      or: [{ status: { equals: 'paid' } }, { and: [{ status: { equals: 'pending' } }, { createdAt: { greater_than: holdCutoff } }] }],
    },
    limit: 2000,
    depth: 0,
    overrideAccess: true,
    select: { sessionStart: true, birthYear: true },
  })
  const key = (start: string, by: number) => `${new Date(start).toISOString()}|${by}`
  const counts = new Map<string, number>()
  for (const b of taken) if (b.sessionStart && b.birthYear) counts.set(key(b.sessionStart, b.birthYear), (counts.get(key(b.sessionStart, b.birthYear)) ?? 0) + 1)

  const nights: TrialNight[] = []
  for (const ws of term.weeklySessions ?? []) {
    for (const ymd of datesOnWeekday(from, to, ws.day)) {
      const start = localToUtc(ymd, ws.startTime).toISOString()
      const years = (ws.birthYears ?? []) as number[]
      nights.push({
        start,
        label: formatDate(start, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }),
        birthYears: years,
        remaining: Object.fromEntries(years.map((by) => [String(by), Math.max(0, (ws.trialSpots ?? 3) - (counts.get(key(start, by)) ?? 0))])),
      })
    }
  }
  return nights.sort((a, b) => a.start.localeCompare(b.start))
}
