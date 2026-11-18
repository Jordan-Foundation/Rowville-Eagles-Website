'use client'

import { useState, useTransition } from 'react'
import { attendanceAction } from '../../v2-actions'

type Row = { id: number; name: string; group: string; attended: boolean; phone: string; parent: string }

/** Tap a player to mark them here (tap again to undo). Saves straight away. */
export function AttendanceList({ rows }: { rows: Row[] }) {
  const [state, setState] = useState<Record<number, boolean>>(Object.fromEntries(rows.map((r) => [r.id, r.attended])))
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const toggle = (id: number) => {
    const next = !state[id]
    setState((s) => ({ ...s, [id]: next }))
    start(async () => {
      const r = await attendanceAction(id, next)
      if (r.error) {
        setError(r.error)
        setState((s) => ({ ...s, [id]: !next }))
      } else setError(null)
    })
  }
  const here = rows.filter((r) => state[r.id]).length
  const groups = [...new Set(rows.map((r) => r.group))]
  return (
    <div className="space-y-5">
      <p className="text-sm" role="status" data-here={here}>{here} of {rows.length} here{pending ? ' · saving…' : ''}</p>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {groups.map((g) => (
        <section key={g} aria-label={g}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">{g}</h2>
          <ul className="space-y-2">
            {rows.filter((r) => r.group === g).map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => toggle(r.id)} aria-pressed={state[r.id]} data-attend={r.name} className={`flex min-h-14 w-full items-center gap-4 border px-4 text-left ${state[r.id] ? 'border-emerald-400 bg-emerald-400/10' : 'border-line'}`}>
                  <span aria-hidden="true" className={`grid h-7 w-7 shrink-0 place-items-center border text-lg ${state[r.id] ? 'border-emerald-400 bg-emerald-400 text-black' : 'border-line'}`}>{state[r.id] ? '✓' : ''}</span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{r.name}</span>
                    <span className="block text-xs text-muted">{r.parent} · {r.phone}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {rows.length === 0 && <p className="text-muted">Nobody is invited to this trial yet. Invite players from the Trialists page.</p>}
    </div>
  )
}
