'use client'

import { useActionState } from 'react'
import type { DateRow } from '@/lib/dates-data'
import { saveDateRow, type DateRowState } from './actions'

export function DateRowForm({ row }: { row: DateRow }) {
  const [state, action, pending] = useActionState<DateRowState, FormData>(saveDateRow, {})
  return (
    <form action={action} className={`grid gap-3 px-5 py-4 lg:grid-cols-[minmax(12rem,1fr)_auto] lg:items-end ${row.muted ? 'opacity-60' : ''}`}>
      <input type="hidden" name="$target" value={row.target} />
      <div>
        <a href={row.href} className="font-semibold hover:underline">{row.title}</a>
        {row.note && <p className="text-xs text-muted">{row.note}</p>}
        {row.locked && <p className="text-xs font-semibold text-muted">{row.locked}</p>}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {row.fields.map((f) => (
          <label key={f.key} className="text-xs text-muted">
            {f.label}
            <input
              name={f.key}
              type={f.type}
              defaultValue={f.value}
              disabled={!!row.locked}
              aria-label={`${row.title} — ${f.label}`}
              className={`mt-1 block rounded-lg border border-line px-3 py-2 text-sm text-ink disabled:bg-surface-2 ${f.type === 'number' ? 'w-24' : ''}`}
            />
            <input type="hidden" name={`$orig:${f.key}`} value={f.value} />
          </label>
        ))}
        {!row.locked && (
          <button disabled={pending} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">{pending ? 'Saving…' : 'Save'}</button>
        )}
        {(state.ok || state.error) && <span role={state.error ? 'alert' : 'status'} className={`text-sm ${state.error ? 'text-red-700' : 'text-emerald-700'}`}>{state.error ?? state.ok}</span>}
      </div>
    </form>
  )
}
