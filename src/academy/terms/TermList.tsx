import Link from 'next/link'
import type { AcademyCoach, AcademyRegistration, AcademyTermSlot, Program } from '@/payload-types'
import { formatDate } from '@/lib/format'
import { groupLabel } from '@/lib/age-groups'
import { slotLabel, slotSessions } from './slots'

const day = (iso: string) => formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short' })
const time = (iso: string) => formatDate(iso, { hour: 'numeric', minute: '2-digit' })

/** Academy term places on the account / player pages: timetable for paid, a button for offers. Expects depth ≥ 1. */
export function TermList({ regs, showPlayer = true }: { regs: AcademyRegistration[]; showPlayer?: boolean }) {
  const now = Date.now()
  return (
    <ul className="mt-4 space-y-4">
      {regs.map((r) => {
        const program = r.program as Program
        const slot = r.slot && typeof r.slot === 'object' ? (r.slot as AcademyTermSlot) : null
        const sessions = slot ? slotSessions(slot, program) : []
        const ahead = sessions.filter((s) => new Date(s.endsAt).getTime() > now)
        const next = ahead.find((s) => !s.cancelled)
        const by = r.playingBirthYear ?? r.birthYear
        const changes = ahead.filter((s) => s.cancelled || s.moved)
        const group = slot?.groups?.find((g) => g.id === r.groupId)
        const names = (v: unknown) => ((v ?? []) as (number | AcademyCoach)[]).filter((c): c is AcademyCoach => typeof c === 'object').map((c) => c.displayName)
        const coachList = slot ? [...new Set([...names(slot.coaches), ...names(group?.coaches)])] : []
        return (
          <li key={r.id} className="rounded-2xl border border-line p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {showPlayer ? `${r.player.firstName} · ` : ''}
                  {program.title}
                  {r.nights === '2' && <span className="ml-2 text-xs font-normal text-muted">2 nights a week</span>}
                </p>
                <p className="text-sm text-muted">{slot ? slotLabel(slot) : by ? `${groupLabel(by)} — training time to be confirmed` : 'Training time to be confirmed'}</p>
                {r.status === 'paid' && (group || coachList.length > 0) && (
                  <p className="text-sm text-muted">{[group?.name, coachList.length ? `Coach${coachList.length > 1 ? 'es' : ''} ${coachList.join(' & ')}` : null].filter(Boolean).join(' · ')}</p>
                )}
              </div>
              <span className="w-fit rounded-full bg-black px-2.5 py-1 text-xs font-semibold text-white">RFA</span>
            </div>
            {r.status === 'paid' ? (
              <>
                {next ? (
                  <p className="mt-3 text-sm"><span className="font-semibold">Next session:</span> {day(next.startsAt)}, {time(next.startsAt)}{next.moved ? ' (changed time)' : ''} · {ahead.filter((s) => !s.cancelled).length} to go</p>
                ) : (
                  <p className="mt-3 text-sm text-muted">This term’s sessions are finished.</p>
                )}
                {changes.map((s) => (
                  <p key={s.date} className="mt-1 text-sm font-semibold text-amber-700">
                    {day(s.startsAt)}: {s.cancelled ? 'no training' : `moved to ${time(s.startsAt)}`}{s.note ? ` — ${s.note}` : ''}
                  </p>
                ))}
                {ahead.length > 0 && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-muted">All session dates</summary>
                    <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                      {sessions.map((s) => (
                        <li key={s.date} className={s.cancelled ? 'text-muted line-through' : new Date(s.endsAt).getTime() < now ? 'text-muted' : ''}>
                          {day(s.startsAt)}, {time(s.startsAt)}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            ) : r.status === 'offered' || r.status === 'pending_payment' ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <p className="text-sm">
                  {r.status === 'offered' ? 'A place is ready' : 'Payment not finished'}
                  {r.status === 'offered' && r.offerExpiresAt ? ` — please confirm by ${formatDate(r.offerExpiresAt, { weekday: 'long', day: 'numeric', month: 'long' })}` : ''}.
                </p>
                <Link href={`/academy/terms/pay/${r.reference}`} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:brightness-110">Confirm and pay</Link>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">Interest registered — we’ll email you when a place is available. Nothing has been charged.</p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
