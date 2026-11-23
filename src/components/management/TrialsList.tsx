import Link from 'next/link'
import { formatDate } from '@/lib/payload'
import { localYmd } from '@/lib/time'
import { byDay, type TrialSession } from '@/academy/trial-list'

/** Booked RFA trial players by day: name, age group / year of birth, time, venue and coach. Today is highlighted. */
export function TrialsList({ sessions, highlight, compact = false }: { sessions: TrialSession[]; highlight?: string; compact?: boolean }) {
  const today = localYmd(new Date())
  if (!sessions.length) return <p className="px-5 py-4 text-sm text-muted" data-no-trials>No RFA trials booked{compact ? ' in the next 14 days' : ''}.</p>
  return (
    <div className="divide-y divide-line">
      {byDay(sessions).map(([ymd, list]) => (
        <div key={ymd} data-trial-day={ymd} className={ymd === today ? 'bg-mgmt/25' : ''}>
          <p className="px-5 pt-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            {ymd === today ? <span className="mr-2 bg-mgmt px-1.5 py-0.5 text-mgmt-ink">Today</span> : null}
            {formatDate(`${ymd}T02:00:00Z`, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <ul className="px-5 pb-3">
            {list.map((s) => (
              <li key={s.key} id={`s-${s.key}`} data-trial-session={s.key} className={`mt-2 border p-3 text-sm ${highlight === s.key ? 'border-mgmt-tint' : 'border-line'}`}>
                <p className="font-semibold">{formatDate(s.startsAt, { hour: 'numeric', minute: '2-digit' })} · {s.program}</p>
                <p className="text-xs text-muted">{[s.venue, s.coaches.length ? `with ${s.coaches.join(', ')}` : 'Coach not set'].filter(Boolean).join(' · ')}</p>
                <ul className="mt-2 space-y-0.5">
                  {s.players.map((x) => (
                    <li key={x.bookingId} data-trial-player={x.name}>
                      {x.name} <span className="text-muted">· {[x.ageGroup, x.birthYear && `born ${x.birthYear}`].filter(Boolean).join(' · ')}</span>
                      {x.reference && <Link href={`/management/search?q=${encodeURIComponent(x.reference)}`} className="ml-2 text-xs underline">booking</Link>}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
