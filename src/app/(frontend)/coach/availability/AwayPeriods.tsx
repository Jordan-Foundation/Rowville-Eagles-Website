'use client'

import { useActionState } from 'react'
import { updateAway, type AwayState } from './actions'

type Period = { from: string; to: string; note?: string | null; label: string }

export function AwayPeriods({ termId, periods, min, max, locked }: { termId: number; periods: Period[]; min: string; max: string; locked: boolean }) {
  const [state, action, pending] = useActionState<AwayState, FormData>(updateAway, {})
  const input = 'w-full border border-line bg-surface px-3 py-2.5 text-ink outline-none focus:border-white [color-scheme:dark]'
  return (
    <section className="panel border border-line p-6">
      <h2 className="font-display text-xl font-semibold uppercase">Away during the term</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Add any dates you know you’ll be away. Families who book a term with you will see these dates at checkout, and the admin will arrange a
        replacement coach with a handover from you.
      </p>

      {periods.length > 0 && (
        <ul className="mt-5 divide-y divide-line border-y border-line">
          {periods.map((p, i) => (
            <li key={`${p.from}-${i}`} className="flex items-center justify-between gap-4 py-3 text-sm">
              <span>
                <strong>{p.label}</strong>
                {p.note && <span className="text-muted"> · {p.note}</span>}
              </span>
              {!locked && (
                <form action={action}>
                  <input type="hidden" name="termId" value={termId} />
                  <input type="hidden" name="remove" value={i} />
                  <button type="submit" disabled={pending} className="text-xs font-semibold uppercase tracking-wider text-muted hover:text-ink">Remove</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {!locked && (
        <form action={action} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
          <input type="hidden" name="termId" value={termId} />
          <label className="text-sm">
            <span className="mb-1.5 block font-medium">First day away</span>
            <input type="date" name="from" required min={min} max={max} className={input} />
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block font-medium">Last day away</span>
            <input type="date" name="to" min={min} max={max} className={input} />
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block font-medium">Note (optional)</span>
            <input name="note" maxLength={120} placeholder="e.g. Interstate tournament" className={input} />
          </label>
          <button type="submit" disabled={pending} className="bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-black hover:bg-white/85 disabled:opacity-50">
            {pending ? 'Saving…' : 'Add'}
          </button>
        </form>
      )}
      {state.error && <p role="alert" className="mt-3 border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{state.error}</p>}
    </section>
  )
}
