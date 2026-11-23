import Link from 'next/link'
import type { Metadata } from 'next'
import { requireCoach } from '@/academy/portal'
import { payload, formatDate } from '@/lib/payload'
import { localYmd } from '@/lib/time'
import { coachDay } from '@/academy/wrap-up'
import { Attendance } from '../sessions/[id]/SessionTools'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Wrap up', robots: { index: false } }

const time = (iso: string) => formatDate(iso, { hour: 'numeric', minute: '2-digit' })

/** The day's wrap-up: mark attendance for every session, then write the session summaries. */
export default async function WrapUp({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const raw = (await searchParams).day
  const ymd = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : localYmd(new Date())
  const { user, coach } = await requireCoach(`/coach/wrap-up?day=${ymd}`)
  const { items, attendanceToMark, summaries } = await coachDay(await payload(), user, coach, ymd)
  const label = formatDate(`${ymd}T02:00:00Z`, { weekday: 'long', day: 'numeric', month: 'long' })
  const done = !attendanceToMark.length && !summaries.length
  return (
    <div className="space-y-8 pb-12">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-muted">Wrap up</p>
        <h1 className="mt-1 font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">{label}</h1>
        <p className="mt-2 text-muted" data-wrapup-summary>{done ? 'All done — thanks!' : [attendanceToMark.length && `${attendanceToMark.length} attendance${attendanceToMark.length === 1 ? '' : 's'} to mark`, summaries.length && `${summaries.length} summar${summaries.length === 1 ? 'y' : 'ies'} to write`].filter(Boolean).join(' · ')}</p>
      </div>

      <section aria-labelledby="att" className="panel border border-line" data-section="attendance">
        <h2 id="att" className="border-b border-line p-5 font-display text-xl font-semibold uppercase">1. Attendance</h2>
        {items.length ? (
          <ul className="divide-y divide-line">
            {items.map((i) => (
              <li key={i.key} className="flex flex-wrap items-center justify-between gap-3 p-5" data-wrapup-item={i.key} data-done={i.attendanceDone ? 'yes' : 'no'}>
                <span>
                  <strong>{time(i.startsAt)}</strong> · {i.label}
                  <span className={`ml-2 text-xs font-semibold uppercase tracking-wider ${i.attendanceDone ? 'text-emerald-300' : 'text-amber-300'}`}>{i.attendanceDone ? '✓ Marked' : 'To mark'}</span>
                </span>
                {i.kind === 'one-on-one' && i.sessionId ? (
                  <Attendance id={i.sessionId} status={i.status ?? 'scheduled'} open={new Date(i.startsAt).getTime() - 15 * 60_000 <= Date.now()} />
                ) : (
                  <Link href={i.href} className="border border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white/40">{i.attendanceDone ? 'Check' : 'Mark attendance'} →</Link>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="p-5 text-sm text-muted">Nothing on this day.</p>}
      </section>

      <section aria-labelledby="sum" className="panel border border-line p-5" data-section="summaries">
        <h2 id="sum" className="font-display text-xl font-semibold uppercase">2. Session summaries</h2>
        {summaries.length ? (
          <>
            <ul className="mt-3 space-y-1 text-sm">{summaries.map((s) => <li key={s.sessionId}>{time(s.at)} · {s.title}</li>)}</ul>
            <Link href="/coach/summaries" className="mt-4 inline-block bg-white px-5 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-black">Write {summaries.length === 1 ? 'the summary' : `${summaries.length} summaries`} →</Link>
          </>
        ) : <p className="mt-2 text-sm text-muted">{items.some((i) => i.kind === 'one-on-one' || i.kind === 'small-group') ? 'All written — thanks!' : 'No 1-on-1s or small groups on this day, so no summaries to write.'}</p>}
      </section>
    </div>
  )
}
