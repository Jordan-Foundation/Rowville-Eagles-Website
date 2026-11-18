import Link from 'next/link'
import { teamAction } from '../v2-actions'

type Team = { id: number; name: string; coach: number | null; finalised: boolean; players: number }
const input = 'min-h-10 border border-line bg-surface px-2 text-sm'
const small = 'min-h-10 border border-line px-3 text-xs font-semibold uppercase tracking-[0.1em] hover:border-white'

/** Teams in this age group: add, rename, choose the coach, delete, place everyone, finalise. */
export function TeamAdmin({ back, round, ageGroup, ageLabel, teams, coaches, unassigned, reviewHref }: {
  back: string
  round: number
  ageGroup: number
  ageLabel: string
  teams: Team[]
  coaches: { id: number; name: string }[]
  unassigned: number
  reviewHref: (id: number) => string
}) {
  const coachSelect = (value: number | null, label: string) => (
    <select name="coach" defaultValue={value ?? ''} aria-label={label} className={input}>
      <option value="">No coach yet</option>
      {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  )
  const hidden = (op: string, squad?: number) => (
    <>
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="round" value={round} />
      <input type="hidden" name="ageGroup" value={ageGroup} />
      <input type="hidden" name="op" value={op} />
      {squad ? <input type="hidden" name="squad" value={squad} /> : null}
    </>
  )
  return (
    <section className="space-y-4 border border-line p-5" aria-label={`${ageLabel} teams`}>
      <h2 className="font-display text-2xl font-semibold uppercase">{ageLabel} teams</h2>
      <ul className="divide-y divide-line">
        {teams.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-3 py-3" data-team-row={t.name}>
            {t.finalised ? (
              <span className="min-w-48"><strong>🔒 {t.name}</strong> <span className="text-xs text-muted">· {t.players} players · finalised</span></span>
            ) : (
              <form action={teamAction} className="flex flex-wrap items-center gap-2">
                {hidden('save', t.id)}
                <input name="name" defaultValue={t.name} aria-label={`Name of ${t.name}`} className={`${input} w-40`} />
                {coachSelect(t.coach, `Coach for ${t.name}`)}
                <button className={small}>Save</button>
              </form>
            )}
            <span className="flex flex-wrap items-center gap-2">
              {!t.finalised && teams.length === 1 && unassigned > 0 && (
                <form action={teamAction}>{hidden('assign-all', t.id)}<button className={small}>Assign all unassigned ({unassigned})</button></form>
              )}
              <Link href={reviewHref(t.id)} className={`${small} inline-flex items-center border-white`}>{t.finalised ? 'Team email' : 'Finalise team'}</Link>
              {!t.finalised && t.players === 0 && (
                <form action={teamAction}>{hidden('delete', t.id)}<button className="text-xs text-muted underline">Delete</button></form>
              )}
            </span>
          </li>
        ))}
      </ul>
      <form action={teamAction} className="flex flex-wrap items-end gap-2" aria-label="Add a team">
        {hidden('save')}
        <label className="grid gap-1 text-xs text-muted">New team name<input name="name" required placeholder={`${ageLabel} Gold`} className={`${input} w-44`} /></label>
        <label className="grid gap-1 text-xs text-muted">Coach{coachSelect(null, 'Coach for the new team')}</label>
        <button className={small}>Add team</button>
      </form>
    </section>
  )
}
