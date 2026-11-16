import type { Payload } from 'payload'
import type { AcademyTerm } from '@/payload-types'
import { localToUtc, localYmd } from '../lib/time'
import { campDayList } from '../lib/camps'
import { slotSessions } from '../academy/terms/slots'
import { addDays, perSession, withSetupPackup, type HourLine, type LineKind } from './rules'
import { financeSettings } from './settings'

/**
 * Every coach's paid time between two local dates (inclusive), built from what the portal already knows:
 * 1-on-1s and small groups, Academy and Mini Ballers training times, confirmed camp days, Eagles training and games
 * (for coaches marked as paid for team coaching), plus Management's manual hours. Setup/pack-up lines are added
 * per block. Nothing is stored — it's recalculated from the sessions every time, so moves and cancellations count.
 */

const q = { overrideAccess: true, pagination: false } as const
const idOf = (v: unknown): number | null => (v && typeof v === 'object' ? ((v as { id?: number }).id ?? null) : typeof v === 'number' ? v : null)
const mins = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60_000))
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export type Coach = { id: number; name: string; active: boolean; userId: number | null }

export async function coachList(p: Payload): Promise<Coach[]> {
  const { docs } = await p.find({ ...q, collection: 'academy-coaches', sort: 'displayName', limit: 500, depth: 0 })
  return docs.map((c) => ({ id: c.id, name: c.displayName, active: c.active !== false, userId: idOf(c.user) }))
}

export async function hourLines(p: Payload, fromYmd: string, toYmd: string, o: { includeFuture?: boolean } = {}): Promise<HourLine[]> {
  const s = await financeSettings(p)
  const from = localToUtc(fromYmd, '00:00').toISOString()
  const to = localToUtc(addDays(toYmd, 1), '00:00').toISOString()
  const now = Date.now()
  const inRange = (iso: string) => iso >= from && iso < to && (o.includeFuture || Date.parse(iso) <= now)
  const lines: HourLine[] = []

  // ── 1-on-1s and small groups ──
  const { docs: sessions } = await p.find({ ...q, collection: 'academy-sessions', where: { and: [{ startsAt: { greater_than_equal: from } }, { startsAt: { less_than: to } }, { kind: { not_equals: 'group-player' } }] }, limit: 20000, depth: 0 })
  const bookingIds = [...new Set(sessions.map((x) => idOf(x.booking)).filter((x): x is number => Boolean(x)))]
  const groupIds = [...new Set(sessions.map((x) => idOf(x.group)).filter((x): x is number => Boolean(x)))]
  const [{ docs: bookings }, { docs: groups }, { docs: terms }, { docs: links }, { docs: adjustments }] = await Promise.all([
    bookingIds.length ? p.find({ ...q, collection: 'academy-bookings', where: { id: { in: bookingIds } }, limit: 20000, depth: 0 }) : Promise.resolve({ docs: [] }),
    groupIds.length ? p.find({ ...q, collection: 'academy-groups', where: { id: { in: groupIds } }, limit: 5000, depth: 0 }) : Promise.resolve({ docs: [] }),
    p.find({ ...q, collection: 'academy-terms', limit: 500, depth: 0 }),
    bookingIds.length ? p.find({ ...q, collection: 'academy-share-links', where: { booking: { in: bookingIds } }, limit: 20000, depth: 0, select: { booking: true, coach: true } }) : Promise.resolve({ docs: [] }),
    p.find({ ...q, collection: 'coach-hour-adjustments', where: { and: [{ date: { greater_than_equal: fromYmd } }, { date: { less_than_equal: toYmd } }] }, limit: 5000, depth: 0 }),
  ])
  const bookingBy = new Map(bookings.map((b) => [b.id, b]))
  const groupBy = new Map(groups.map((g) => [g.id, g]))
  const termBy = new Map((terms as AcademyTerm[]).map((t) => [t.id, t]))
  const shareCoach = new Map(links.map((l) => [idOf(l.booking), idOf(l.coach)]))
  const paidCancelled = new Set(adjustments.filter((a) => a.kind === 'paid-cancellation' && a.sessionKey).map((a) => a.sessionKey!))

  for (const x of sessions) {
    const key = `as:${x.id}`
    const went = ['scheduled', 'completed', 'no_show'].includes(x.status)
    if (!went && !(x.status === 'cancelled' && paidCancelled.has(key))) continue
    if (!inRange(x.startsAt)) continue
    const b = bookingBy.get(idOf(x.booking) ?? -1)
    const g = groupBy.get(idOf(x.group) ?? -1)
    const term = termBy.get(idOf(b?.term ?? g?.term) ?? -1)
    const minutes = term?.sessionMinutes || 60
    const endsAt = new Date(Date.parse(x.startsAt) + minutes * 60_000).toISOString()
    const coachId = (x.coverCoach && x.coverStatus !== 'declined' ? idOf(x.coverCoach) : null) ?? idOf(x.coach)
    if (!coachId) continue
    const group = x.kind === 'group-slot'
    // Share-link bonus: the booking came through this coach's link, and this coach delivered the session
    const linkCoach = b ? shareCoach.get(b.id) : null
    const refunded = b ? ['refunded'].includes(b.status) : false
    const paid = b ? Math.max(0, (b.amount ?? 0)) : 0
    lines.push({
      key, coachId, date: localYmd(new Date(x.startsAt)), startsAt: x.startsAt, endsAt, minutes,
      kind: x.status === 'cancelled' ? 'paid-cancellation' : group ? 'small-group' : 'one-on-one',
      venue: term?.location ?? null,
      client: group ? (g?.reference ? `Small group ${g.reference}` : 'Small group') : b ? `${b.player?.firstName ?? ''} ${b.player?.lastName ?? ''}`.trim() : null,
      shareLink: Boolean(!group && linkCoach && linkCoach === coachId && !refunded && x.status !== 'cancelled'),
      customerAmount: !group && b ? perSession(paid, b.sessionsTotal || 1) : null,
    })
  }

  // ── Academy and Mini Ballers training times ──
  const { docs: slots } = await p.find({ ...q, collection: 'academy-term-slots', limit: 1000, depth: 1 })
  for (const slot of slots) {
    const prog = typeof slot.program === 'object' ? slot.program : null
    if (!prog?.startDate) continue
    const kind: LineKind = prog.type === 'toddler' ? 'mini-ballers' : 'academy'
    const coachIds = [...new Set([...(slot.coaches ?? []), ...(slot.groups ?? []).flatMap((gr) => gr.coaches ?? [])].map(idOf).filter((x): x is number => Boolean(x)))]
    if (!coachIds.length) continue
    for (const ses of slotSessions(slot, prog)) {
      const key = `slot:${slot.id}:${ses.date}`
      if ((ses.cancelled && !paidCancelled.has(key)) || !inRange(ses.startsAt)) continue
      for (const coachId of coachIds) lines.push({ key: `${key}:${coachId}`, coachId, date: ses.date, startsAt: ses.startsAt, endsAt: ses.endsAt, minutes: mins(ses.startsAt, ses.endsAt), kind: ses.cancelled ? 'paid-cancellation' : kind, venue: slot.venue ?? prog.location ?? null, client: prog.title })
    }
  }

  // ── Holiday camps (confirmed coaches, each camp day) ──
  const { docs: campCoaches } = await p.find({ ...q, collection: 'camp-coaches', where: { status: { equals: 'confirmed' } }, limit: 2000, depth: 1 })
  for (const cc of campCoaches) {
    const prog = typeof cc.program === 'object' ? cc.program : null
    const coachId = idOf(cc.coach)
    if (!prog || !coachId) continue
    for (const d of campDayList(prog)) {
      const startsAt = localToUtc(d.date, d.start).toISOString()
      const endsAt = localToUtc(d.date, d.end).toISOString()
      if (!inRange(startsAt)) continue
      lines.push({ key: `camp:${prog.id}:${d.date}:${coachId}`, coachId, date: d.date, startsAt, endsAt, minutes: mins(startsAt, endsAt), kind: 'camp', venue: prog.location ?? null, client: prog.title })
    }
  }

  // ── Rowville Eagles: training (within the season set in Finance settings) and games, for coaches marked as paid ──
  const { docs: profiles } = await p.find({ ...q, collection: 'coach-pay-profiles', where: { eaglesPaid: { equals: true } }, limit: 500, depth: 1 })
  const paidByUser = new Map<number, number>()
  for (const pr of profiles) if (typeof pr.coach === 'object' && pr.coach && idOf(pr.coach.user)) paidByUser.set(idOf(pr.coach.user)!, pr.coach.id)
  if (paidByUser.size) {
    const { docs: teams } = await p.find({ ...q, collection: 'teams', where: { and: [{ type: { equals: 'rowville' } }, { archived: { not_equals: true } }] }, limit: 500, depth: 0 })
    const seasonFrom = s.eaglesSeasonStart && /^\d{4}-\d{2}-\d{2}$/.test(s.eaglesSeasonStart) ? s.eaglesSeasonStart : null
    const seasonTo = s.eaglesSeasonEnd && /^\d{4}-\d{2}-\d{2}$/.test(s.eaglesSeasonEnd) ? s.eaglesSeasonEnd : null
    for (const t of teams) {
      const coachIds = (t.coaches ?? []).map((u) => paidByUser.get(idOf(u) ?? -1)).filter((x): x is number => Boolean(x))
      if (!coachIds.length) continue
      if (seasonFrom && seasonTo) {
        for (let d = fromYmd > seasonFrom ? fromYmd : seasonFrom; d <= toYmd && d <= seasonTo; d = addDays(d, 1)) {
          const weekday = DAYS[new Date(`${d}T00:00:00Z`).getUTCDay()]
          for (const [i, tr] of (t.training ?? []).entries()) {
            if (tr.day !== weekday || !tr.start) continue
            const startsAt = localToUtc(d, tr.start).toISOString()
            const endsAt = localToUtc(d, tr.end || tr.start).toISOString()
            if (!inRange(startsAt)) continue
            for (const coachId of coachIds) lines.push({ key: `et:${t.id}:${i}:${d}:${coachId}`, coachId, date: d, startsAt, endsAt: tr.end ? endsAt : new Date(Date.parse(startsAt) + 60 * 60_000).toISOString(), minutes: tr.end ? mins(startsAt, endsAt) : 60, kind: 'eagles-training', venue: tr.location ?? null, client: t.name })
          }
        }
      }
      for (const f of t.fixtures ?? []) {
        if (!f.startsAt || !inRange(f.startsAt)) continue
        const minutes = s.eaglesGameMinutes || 90
        for (const coachId of coachIds) lines.push({ key: `eg:${t.id}:${f.id}:${coachId}`, coachId, date: localYmd(new Date(f.startsAt)), startsAt: f.startsAt, endsAt: new Date(Date.parse(f.startsAt) + minutes * 60_000).toISOString(), minutes, kind: 'eagles-game', venue: f.venue ?? null, client: `${t.name} vs ${f.opponent}` })
      }
    }
  }

  // ── Setup & pack-up per block, then Management's manual hours ──
  const withBlocks = withSetupPackup(lines, { setupMinutes: s.setupMinutes, packupMinutes: s.packupMinutes, gapMinutes: s.blockGapMinutes, kinds: [...s.setupKinds, 'paid-cancellation'] })
  for (const a of adjustments) {
    if (a.kind !== 'manual') continue
    const coachId = idOf(a.coach)
    if (!coachId) continue
    const startsAt = localToUtc(a.date, a.startTime && /^\d{2}:\d{2}$/.test(a.startTime) ? a.startTime : '09:00').toISOString()
    withBlocks.push({ key: `adj:${a.id}`, coachId, date: a.date, startsAt, endsAt: new Date(Date.parse(startsAt) + Math.max(0, a.minutes) * 60_000).toISOString(), minutes: a.minutes, kind: 'manual', note: a.reason })
  }
  return withBlocks.sort((a, b) => a.coachId - b.coachId || a.startsAt.localeCompare(b.startsAt))
}
