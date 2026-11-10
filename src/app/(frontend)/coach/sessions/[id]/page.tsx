import { ContactButtons, MedicalBadge } from '@/components/coach/ContactButtons'
import { formatPhone } from '@/lib/phone'
import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { payload, formatDate } from '@/lib/payload'
import { requireCoach } from '@/academy/portal'
import { loadCoachSession } from '@/academy/coach-sessions'
import { ageOn, canMarkAttendance, sessionPayment } from '@/academy/session-view'
import { Attendance, Notes, SessionHelp } from './SessionTools'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Session' }

const statusLabel = { scheduled: 'Booked', completed: 'Attended', no_show: 'No-show' } as Record<string, string>

export default async function CoachSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { coach } = await requireCoach(`/coach/sessions/${id}`)
  const p = await payload()
  const data = await loadCoachSession(p, coach.id, Number(id))
  if (!data) notFound()
  const { session: s, booking: b, player, role, bookedCoach, coverCoach, history } = data
  const pay = sessionPayment(s, b)
  const term = typeof b.term === 'object' ? b.term : null
  // Notes carry over: the latest earlier session with this player that has notes
  const lastNotes = [...history].filter((h) => h.startsAt < s.startsAt && h.coachNotes?.trim()).sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0] ?? null
  const tel = (n: string) => `tel:${n.replace(/\s+/g, '')}`

  return (
    <div className="space-y-10">
      <div>
        <Link href="/coach/sessions" className="text-sm text-muted hover:text-ink">← My sessions</Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.25em] text-muted">
          {formatDate(s.startsAt, { weekday: 'long', day: 'numeric', month: 'long' })} · {formatDate(s.startsAt, { hour: 'numeric', minute: '2-digit' })}
          {term ? ` · ${term.sessionMinutes} min · ${term.location}` : ''}
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">{player.name}</h1>
        <p className="mt-2 text-muted">
          Age {ageOn(player.dateOfBirth)}
          {player.position ? ` · ${player.position}` : ''}
          {player.currentClub ? ` · ${player.currentClub}` : ''}
          {' · '}
          {b.type === 'term' ? `Term booking, session ${data.sessionNumber} of ${data.bookingSessions}` : b.packSize ? `Holiday pack, session ${data.sessionNumber} of ${data.bookingSessions}` : 'Casual session'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wider">
          <span className="border border-line px-2 py-1">{statusLabel[s.status] ?? s.status}</span>
          <span className={`px-2 py-1 ${pay.tone === 'bad' ? 'bg-red-500/20 text-red-300' : 'border border-line'}`}>{pay.label}</span>
          {!player.photoConsent && <span className="border border-white/60 px-2 py-1">No photos / video</span>}
        </div>
      </div>

      {role === 'cover' && (
        <div role="note" className="border-2 border-white/60 p-5 text-sm">
          <p className="font-semibold uppercase tracking-wider">You’re covering for {bookedCoach.displayName}</p>
          <p className="mt-2 whitespace-pre-line">{s.coverNote || 'No handover notes yet — check with the Academy or the booked coach.'}</p>
        </div>
      )}
      {role === 'covered' && (
        <div role="note" className="border border-line p-5 text-sm">
          <p className="font-semibold uppercase tracking-wider">{coverCoach?.displayName} is covering this session</p>
          <p className="mt-2 text-muted">You’re away. Handover notes: {s.coverNote || 'none yet'}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel space-y-4 border border-line p-6">
          <h2 className="font-display text-xl font-semibold uppercase">Player</h2>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-muted">Goals</dt><dd className="mt-0.5 whitespace-pre-line">{player.goals || '—'}</dd></div>
            <div>
              <dt className="text-muted">Medical / injury notes</dt>
              <dd className="mt-0.5 whitespace-pre-line">{player.medical ? <MedicalBadge note={player.medical} /> : 'None given'}</dd>
            </div>
            <div>
              <dt className="text-muted">Emergency contact</dt>
              <dd className="mt-0.5">{player.emergencyName || '—'}{player.emergencyPhone && <> · <a href={tel(player.emergencyPhone)} className="underline">{formatPhone(player.emergencyPhone)}</a></>}</dd>
            </div>
          </dl>
        </section>

        <section className="panel space-y-4 border border-line p-6">
          <h2 className="font-display text-xl font-semibold uppercase">Parent / guardian</h2>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-muted">Name</dt><dd className="mt-0.5">{player.parent.name}</dd></div>
            <div><dt className="text-muted">Mobile</dt><dd className="mt-0.5">{formatPhone(player.parent.mobile)}</dd></div>
            <div><dt className="text-muted">Email</dt><dd className="mt-0.5"><a href={`mailto:${player.parent.email}`} className="underline">{player.parent.email}</a></dd></div>
          </dl>
          <ContactButtons compact name={player.parent.name} phone={player.parent.mobile} accountId={typeof b.account === 'object' ? b.account?.id : b.account} />
          <p className="text-xs text-muted">Child Safe: contact the parent or guardian only — never the player directly. Booking {b.reference}.</p>
        </section>
      </div>

      {lastNotes && (
        <section className="border-l-4 border-white/60 bg-white/5 p-5" aria-label="From last session">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">From last session · {formatDate(lastNotes.startsAt, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
          <p className="mt-2 whitespace-pre-line text-sm">{lastNotes.coachNotes}</p>
        </section>
      )}

      {role !== 'covered' && new Date(s.startsAt).getTime() > Date.now() - 60 * 60_000 && s.status === 'scheduled' && (
        <section className="panel space-y-4 border border-line p-6">
          <h2 className="font-display text-xl font-semibold uppercase">On the day</h2>
          <SessionHelp id={s.id} canCover={role === 'coach' && new Date(s.startsAt) > new Date()} needsCover={Boolean(s.needsCover)} />
        </section>
      )}

      <section className="panel space-y-4 border border-line p-6">
        <h2 className="font-display text-xl font-semibold uppercase">Attendance</h2>
        {role === 'covered' ? <p className="text-sm text-muted">The cover coach marks attendance.</p> : <Attendance id={s.id} status={s.status} open={canMarkAttendance(s.startsAt)} />}
      </section>

      <section className="panel space-y-4 border border-line p-6">
        <h2 className="font-display text-xl font-semibold uppercase">Your notes</h2>
        <Notes id={s.id} notes={s.coachNotes ?? ''} disabled={role === 'covered'} />
      </section>

      {history.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-semibold uppercase">{player.firstName}’s other sessions with you</h2>
          <ol className="panel mt-4 divide-y divide-line border border-line text-sm">
            {[...history].reverse().map((h) => (
              <li key={h.id}>
                <Link href={`/coach/sessions/${h.id}`} className="grid gap-1 p-4 hover:bg-white/5 sm:grid-cols-[12rem_7rem_1fr] sm:gap-4">
                  <span className="font-medium">{formatDate(h.startsAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                  <span className="text-muted">{statusLabel[h.status] ?? h.status}</span>
                  <span className="line-clamp-2 text-muted">{h.coachNotes || ''}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
