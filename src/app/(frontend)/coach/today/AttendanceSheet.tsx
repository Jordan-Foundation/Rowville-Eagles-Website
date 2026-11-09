'use client'

import { useActionState, useState, type ReactNode } from 'react'
import { saveAttendanceAction, type AttendanceState } from './actions'

/** Tick who's here, "Mark all present", Save. Each row's details (medical, contacts) come from the server. */
export function AttendanceSheet({ id, rows, initial }: { id: string; rows: { id: number; name: string; details: ReactNode }[]; initial: number[] | null }) {
  const [present, setPresent] = useState<Set<number>>(new Set(initial ?? []))
  const [state, action, pending] = useActionState<AttendanceState, FormData>(saveAttendanceAction, {})
  const all = rows.length > 0 && present.size === rows.length
  const toggle = (rid: number) => setPresent((s) => { const n = new Set(s); if (n.has(rid)) n.delete(rid); else n.add(rid); return n })
  return (
    <form action={action}>
      <input type="hidden" name="key" value={id} />
      {[...present].map((rid) => <input key={rid} type="hidden" name="present" value={rid} />)}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <p className="text-sm"><strong>{present.size}</strong> of {rows.length} here</p>
        <button type="button" onClick={() => setPresent(all ? new Set() : new Set(rows.map((r) => r.id)))} className="min-h-10 border border-white/40 px-4 text-xs font-semibold uppercase tracking-[0.15em] hover:bg-white hover:text-black">
          {all ? 'Clear all' : 'Mark all present'}
        </button>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="flex gap-4 p-5">
            <label className="flex shrink-0 cursor-pointer items-start pt-0.5">
              <input type="checkbox" checked={present.has(r.id)} onChange={() => toggle(r.id)} aria-label={`${r.name} is here`} className="h-6 w-6 accent-white" />
            </label>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{r.name}</p>
              {r.details}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3 border-t border-line p-5">
        <button disabled={pending} className="min-h-11 bg-white px-6 text-sm font-semibold uppercase tracking-[0.15em] text-black disabled:opacity-60">{pending ? 'Saving…' : 'Save attendance'}</button>
        {state.saved && <p role="status" className="text-sm text-emerald-300">{state.saved}</p>}
        {state.error && <p role="alert" className="text-sm text-red-300">{state.error}</p>}
      </div>
    </form>
  )
}
