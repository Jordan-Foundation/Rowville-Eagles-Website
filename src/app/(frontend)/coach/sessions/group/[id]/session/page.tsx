import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { payload, formatDate } from '@/lib/payload'
import { requireCoach } from '@/academy/portal'
import { loadGroupSession } from '@/academy/coach-sessions'
import { ageOn, canMarkAttendance, sessionPayment } from '@/academy/session-view'
import { ContactButtons, MedicalBadge } from '@/components/coach/ContactButtons'
import { Attendance } from '../../../[id]/SessionTools'
import { groupTitle } from '@/academy/groups'
import { GroupLate, GroupNeedCover } from './LateButton'
import type { AcademyCoach, AcademyTerm } from '@/payload-types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Small group session' }

const toneCls = { ok: 'text-emerald-300', pending: 'text-muted', bad: 'font-semibold text-red-300' } as Record<string, string>

/** One small group session: every player, their medical notes, contacts, payment and attendance. */
export default async function GroupSessionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ at?: string }> }) {
  const { id } = await params
  const { at } = await searchParams
  const { coach } = await requireCoach(`/coach/sessions/group/${id}/session?at=${encodeURIComponent(at ?? '')}`)
  const p = await payload()
  const data = await loadGroupSession(p, coach.id, Number(id), at ?? '')
  if (!data) notFound()
  const { group: g, rows } = data
  const startsAt = rows[0].session.startsAt
  const term = typeof g.term === 'object' ? (g.term as AcademyTerm) : null
  const coachName = typeof g.coach === 'object' ? (g.coach as AcademyCoach).displayName : coach.displayName
  const role = rows[0].role
  return (
    <div className="space-y-8">
      <div>
        <Link href="/coach/sessions" className="text-sm text-muted hover:text-ink">← My sessions</Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.25em] text-muted">
          {formatDate(startsAt, { weekday: 'long', day: 'numeric', month: 'long' })} · {formatDate(startsAt, { hour: 'numeric', minute: '2-digit' })}
          {term ? ` · ${term.sessionMinutes} min · ${term.location}` : ''}
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">{groupTitle(rows.length, coachName)}</h1>
        <p className="mt-2 text-muted">{rows.map((r) => r.player.firstName).join(', ')} · <Link href={`/coach/sessions/group/${g.id}`} className="underline">Group details</Link></p>
        {role === 'cover' && <p className="mt-2 text-sm font-semibold">You’re covering this session for {coachName}.</p>}
      </div>
      {new Date(startsAt).getTime() > Date.now() - 60 * 60_000 && <GroupLate groupId={g.id} at={new Date(startsAt).toISOString()} />}
      {role === 'coach' && new Date(startsAt).getTime() > Date.now() && (rows[0].session.needsCover ? <p className="text-sm text-amber-200">Cover requested{rows[0].session.coverCoach ? ' — a cover coach is assigned.' : ' — the Academy is arranging a coach.'}</p> : <GroupNeedCover groupId={g.id} at={new Date(startsAt).toISOString()} />)}
      <ul className="space-y-4">
        {rows.map(({ session: s, booking: b, player }) => {
          const pay = sessionPayment(s, b)
          return (
            <li key={s.id} className="panel border border-line p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-2xl font-semibold uppercase">{player.name}</p>
                  <p className="text-sm text-muted">Age {ageOn(player.dateOfBirth)}{player.currentClub ? ` · ${player.currentClub}` : ''} · <span className={toneCls[pay.tone] ?? ''}>{pay.label}</span></p>
                  {player.medical && <p className="mt-2 text-sm"><MedicalBadge note={player.medical} /></p>}
                  {player.goals && <p className="mt-2 text-sm"><span className="text-muted">Working on:</span> {player.goals}</p>}
                  <p className="mt-2 text-sm text-muted">Parent: {player.parent.name}{player.emergencyName ? ` · Emergency: ${player.emergencyName} ${player.emergencyPhone ?? ''}` : ''}</p>
                </div>
                <ContactButtons compact name={player.parent.name} phone={player.parent.mobile} accountId={typeof b.account === 'object' ? b.account?.id : b.account} />
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                {role === 'covered' ? <p className="text-sm text-muted">The cover coach marks attendance.</p> : <Attendance id={s.id} status={s.status} open={canMarkAttendance(s.startsAt)} />}
                <Link href={`/coach/sessions/${s.id}`} className="text-sm underline">Notes & history →</Link>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
