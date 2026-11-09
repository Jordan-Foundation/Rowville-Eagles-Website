import { markSeen } from '@/lib/seen'
import Link from 'next/link'
import type { Metadata } from 'next'
import { payload, formatDate } from '@/lib/payload'
import { requireCoach } from '@/academy/portal'
import { attendanceDue, coachSessions } from '@/academy/coach-sessions'
import { ageOn, sessionPayment } from '@/academy/session-view'
import { toYmd } from '@/academy/term-dates'
import { localToUtc } from '@/lib/time'
import { coachGroupList, groupTitle, groupWhen } from '@/academy/groups'
import { GROUP_STATUS } from '@/academy/group-rules'
import { nudgeGroupClock } from '@/academy/group-clock'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'My sessions' }

const DAY = 86_400_000
const roleNote = { coach: null, cover: 'You’re covering', covered: 'Being covered' } as const

export default async function CoachSessionsPage({ searchParams }: { searchParams: Promise<{ weeks?: string }> }) {
  const { coach, user: me } = await requireCoach('/coach/sessions')
  nudgeGroupClock()
  void markSeen(await payload(), me.id, 'sessions')
  const asked = (await searchParams).weeks
  let weeks = asked === 'all' ? 52 : Math.min(52, Math.max(1, Number(asked) || 4))
  const p = await payload()
  const now = new Date()
  const startOfToday = localToUtc(toYmd(now.toISOString()), '00:00') // Sydney midnight
  const [soon, due, groups] = await Promise.all([
    coachSessions(p, coach.id, { from: startOfToday, to: new Date(now.getTime() + weeks * 7 * DAY) }),
    attendanceDue(p, coach.id, now),
    coachGroupList(p, coach.id),
  ])
  let upcoming = soon
  // Nothing soon (e.g. before term starts)? Show everything that's booked, so a new booking is never hidden.
  let widened = false
  if (!asked && !upcoming.length) {
    weeks = 52
    upcoming = await coachSessions(p, coach.id, { from: startOfToday, to: new Date(now.getTime() + weeks * 7 * DAY) })
    widened = upcoming.length > 0
  }
  const dueIds = new Set(due.map((d) => d.session.id))
  const future = upcoming.filter((x) => !dueIds.has(x.session.id))
  const days = new Map<string, typeof future>()
  for (const x of future) {
    const k = toYmd(x.session.startsAt)
    days.set(k, [...(days.get(k) ?? []), x])
  }
  const todayKey = toYmd(now.toISOString())

  const Row = ({ x, showDate }: { x: (typeof future)[number]; showDate?: boolean }) => {
    const pay = sessionPayment(x.session, x.booking)
    const note = roleNote[x.role]
    return (
      <li>
        <Link href={`/coach/sessions/${x.session.id}`} className="grid gap-1 p-5 transition hover:bg-white/5 sm:grid-cols-[7rem_1fr_auto] sm:items-center sm:gap-6">
          <p className="font-display text-xl font-semibold">
            {showDate && <span className="mr-2 text-sm font-normal uppercase text-muted">{formatDate(x.session.startsAt, { weekday: 'short', day: 'numeric', month: 'short' })}</span>}
            {formatDate(x.session.startsAt, { hour: 'numeric', minute: '2-digit' })}
          </p>
          <div>
            <p className="font-semibold">
              {x.booking.player.firstName} {x.booking.player.lastName}
              <span className="ml-2 text-sm font-normal text-muted">age {ageOn(x.booking.player.dateOfBirth)}</span>
            </p>
            <p className="text-sm text-muted">
              {x.booking.type === 'term' ? 'Term' : 'Casual'}
              {x.booking.player.medical?.trim() && <span className="ml-2 bg-red-600 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">Medical</span>}
              {' · '}
              <span className={pay.tone === 'bad' ? 'font-semibold text-red-300' : ''}>{pay.label}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {note && <span className="border border-white/40 px-2 py-1 text-xs font-semibold uppercase tracking-wider">{note}</span>}
            {x.session.status === 'completed' && <span className="bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wider text-black">Attended</span>}
            {x.session.status === 'no_show' && <span className="bg-red-500/20 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-red-300">No-show</span>}
          </div>
        </Link>
      </li>
    )
  }

  return (
    <div className="space-y-12">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">My sessions</h1>
        <p className="mt-3 text-muted">Your 1-on-1s and small groups, including sessions you’re covering. Open one for the player’s goals, medical notes and parent contact.</p>
        <Link href="/coach/sessions/group/new" className="mt-5 inline-block bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-black">+ New group session</Link>
      </div>

      {groups.length > 0 && (
        <section aria-labelledby="small-groups">
          <h2 id="small-groups" className="font-display text-2xl font-semibold uppercase">Small groups</h2>
          <ul className="panel mt-4 divide-y divide-line border border-line">
            {groups.map(({ group: g, invites }) => {
              const live = invites.filter((i) => i.status !== 'declined')
              const paid = invites.filter((i) => i.status === 'paid' || i.status === 'weekly').length
              const waiting = live.length - paid
              return (
                <li key={g.id}>
                  <Link href={`/coach/sessions/group/${g.id}`} className="flex flex-wrap items-center justify-between gap-3 p-5 transition hover:bg-white/5">
                    <div>
                      <p className="font-semibold">{groupTitle(live.length, coach.displayName)}</p>
                      <p className="text-sm text-muted">{groupWhen(g)}</p>
                      <p className="mt-1 text-xs text-muted">{live.map((i) => i.invitee.playerFirstName).join(', ')}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold">{paid} of {live.length} paid</p>
                      <p className={`text-xs ${g.status === 'shortfall' || invites.some((i) => i.status === 'overdue') ? 'text-red-300' : 'text-muted'}`}>
                        {g.status === 'forming' && waiting > 0 && g.paymentDeadline ? `Pay by ${formatDate(g.paymentDeadline, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : GROUP_STATUS[g.status]}
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {due.length > 0 && (
        <section>
          <h2 className="font-display text-2xl font-semibold uppercase">Mark attendance</h2>
          <p className="mt-1 text-sm text-muted">These sessions have started but haven’t been marked yet.</p>
          <ol className="panel mt-4 divide-y divide-line border border-line">{due.map((x) => <Row key={x.session.id} x={x} showDate />)}</ol>
        </section>
      )}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold uppercase">Coming up</h2>
          <div className="flex gap-1 text-sm">
            {[2, 4, 8].map((w) => (
              <Link key={w} href={`/coach/sessions?weeks=${w}`} className={`px-3 py-1.5 ${w === weeks ? 'bg-white text-black' : 'text-muted hover:text-ink'}`}>{w} weeks</Link>
            ))}
            <Link href="/coach/sessions?weeks=all" className={`px-3 py-1.5 ${weeks === 52 ? 'bg-white text-black' : 'text-muted hover:text-ink'}`}>All upcoming</Link>
          </div>
        </div>
        {widened && <p className="mt-3 text-sm text-muted">Nothing in the next 4 weeks — here’s everything that’s booked.</p>}
        {days.size === 0 ? (
          <p className="mt-4 text-muted">{weeks === 52 ? 'No upcoming sessions booked yet.' : <>No sessions in the next {weeks} weeks. <Link href="/coach/sessions?weeks=all" className="underline">Show all upcoming</Link></>}</p>
        ) : (
          <div className="mt-4 space-y-6">
            {[...days.entries()].map(([day, list]) => (
              <div key={day}>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
                  {day === todayKey ? 'Today' : formatDate(list[0].session.startsAt, { weekday: 'long', day: 'numeric', month: 'long' })} · {list.length} session{list.length === 1 ? '' : 's'}
                </p>
                <ol className="panel mt-2 divide-y divide-line border border-line">{list.map((x) => <Row key={x.session.id} x={x} />)}</ol>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
