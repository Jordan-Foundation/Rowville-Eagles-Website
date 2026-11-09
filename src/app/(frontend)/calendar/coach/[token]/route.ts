import { payload } from '@/lib/payload'
import { icsFile, type CalEvent } from '@/lib/ics'
import { siteBase } from '@/lib/seo'
import { coachSessions } from '@/academy/coach-sessions'
import { coachGroups } from '@/academy/terms/coach-groups'
import { datesOnWeekday, localToUtc, localYmd } from '@/lib/time'

export const dynamic = 'force-dynamic'

/**
 * A coach's private calendar feed (subscribe once on the phone; it refreshes itself): 1-on-1s, Academy groups,
 * team training and fixtures. Players appear as first name + initial only.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/, '')
  if (!/^[\w-]{24,64}$/.test(token)) return new Response('Not found', { status: 404 })
  const p = await payload()
  const { docs } = await p.find({ pagination: false, collection: 'academy-coaches', where: { calendarToken: { equals: token } }, limit: 1, depth: 0, overrideAccess: true, showHiddenFields: true })
  const coach = docs[0]
  if (!coach) return new Response('Not found', { status: 404 })
  const userId = typeof coach.user === 'object' ? coach.user.id : coach.user
  const now = Date.now()
  const from = new Date(now - 14 * 86_400_000)
  const to = new Date(now + 120 * 86_400_000)
  const inWindow = (iso: string) => iso >= from.toISOString() && iso <= to.toISOString()
  const events: CalEvent[] = []
  const base = siteBase()

  const [ones, groups, teams] = await Promise.all([
    coachSessions(p, coach.id, { from, to }),
    coachGroups(p, coach.id),
    p.find({ pagination: false, collection: 'teams', where: { coaches: { in: [userId] }, archived: { not_equals: true } }, limit: 50, depth: 0, overrideAccess: true }),
  ])
  for (const { session: s, booking: b, role } of ones) {
    if (role === 'covered') continue
    const term = typeof b.term === 'object' ? b.term : null
    events.push({ uid: `s${s.id}@rowvilleeagles`, title: `1-on-1 · ${b.player.firstName} ${b.player.lastName.charAt(0)}.${role === 'cover' ? ' (cover)' : ''}`, start: s.startsAt, end: new Date(Date.parse(s.startsAt) + (term?.sessionMinutes ?? 60) * 60_000).toISOString(), location: term?.location, url: `${base}/coach/sessions/${s.id}` })
  }
  for (const g of groups) {
    for (const s of g.sessions) {
      if (s.cancelled || !inWindow(s.startsAt)) continue
      events.push({ uid: `g${g.key.replace(':', '-')}-${s.date}@rowvilleeagles`, title: `${g.title} (${g.players.length})`, start: s.startsAt, end: s.endsAt, location: g.slot.venue, description: g.program.title, url: `${base}/coach/today?date=${s.date}` })
    }
  }
  for (const t of teams.docs) {
    for (const tr of t.training ?? []) {
      for (const ymd of datesOnWeekday(localYmd(new Date(now)), localYmd(new Date(now + 84 * 86_400_000)), tr.day)) {
        events.push({ uid: `t${t.id}-${tr.id ?? tr.start}-${ymd}@rowvilleeagles`, title: `${t.name} training`, start: localToUtc(ymd, tr.start).toISOString(), end: tr.end ? localToUtc(ymd, tr.end).toISOString() : null, location: tr.location, url: `${base}/coach/today?date=${ymd}` })
      }
    }
    for (const f of t.fixtures ?? []) {
      if (!inWindow(f.startsAt)) continue
      events.push({ uid: `f${t.id}-${f.id ?? f.startsAt}@rowvilleeagles`, title: `${t.name} vs ${f.opponent}`, start: f.startsAt, end: new Date(Date.parse(f.startsAt) + 90 * 60_000).toISOString(), location: f.venue, url: `${base}/teams/${t.slug}` })
    }
  }
  return new Response(icsFile(events, `${coach.displayName} · Rowville Eagles`), { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'private, no-store' } })
}
