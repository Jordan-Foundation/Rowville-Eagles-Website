'use client'

import { useActionState } from 'react'
import { createCycleAction, createReportsAction, releaseAction, type CycleState } from './actions'

const btn = 'rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50'
const input = 'mt-1 block w-full rounded-lg border border-line px-3 py-2'

type Opt = { id: number; label: string; hint?: string }

export function NewCycleForm({ programs, teams, season }: { programs: Opt[]; teams: Opt[]; season: number }) {
  const [state, action, pending] = useActionState<CycleState, FormData>(createCycleAction, {})
  return (
    <form action={action} className="space-y-5 rounded-2xl border border-line p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-semibold">Name<input name="name" required placeholder="e.g. Mid-year 2027" className={input} /></label>
        <label className="text-sm font-semibold">Season<input name="season" type="number" required defaultValue={season} className={input} /></label>
        <label className="text-sm font-semibold">Coaches finish by<input name="dueDate" type="date" required className={input} /></label>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">Academy term programs</legend>
        {programs.length ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {programs.map((o) => <label key={o.id} className="flex gap-2 text-sm"><input type="checkbox" name="programs" value={o.id} /> {o.label}{o.hint && <span className="text-muted">· {o.hint}</span>}</label>)}
          </div>
        ) : <p className="mt-1 text-sm text-muted">None yet.</p>}
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold">Rowville & tournament teams</legend>
        {teams.length ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {teams.map((o) => <label key={o.id} className="flex gap-2 text-sm"><input type="checkbox" name="teams" value={o.id} /> {o.label}{o.hint && <span className="text-muted">· {o.hint}</span>}</label>)}
          </div>
        ) : <p className="mt-1 text-sm text-muted">None yet.</p>}
      </fieldset>
      <p className="text-xs text-muted">Mini Ballers aren’t included — there’s no curriculum report for under-5s.</p>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className={btn}>{pending ? 'Saving…' : 'Create report round'}</button>
    </form>
  )
}

export function CreateReportsButton({ cycle, first }: { cycle: number; first: boolean }) {
  const [state, action, pending] = useActionState<CycleState, FormData>(createReportsAction, {})
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="cycle" value={cycle} />
      <button disabled={pending} className={btn}>{pending ? 'Creating…' : first ? 'Create reports' : 'Add reports for new players'}</button>
      {state.message && <p role="status" className="text-sm">{state.message}</p>}
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    </form>
  )
}

export function ReleaseButton({ cycle, count }: { cycle: number; count: number }) {
  const [state, action, pending] = useActionState<CycleState, FormData>(releaseAction, {})
  return (
    <form
      action={action}
      onSubmit={(e) => { if (!confirm(`Release ${count} approved report${count === 1 ? '' : 's'}? They’ll appear on player profiles and each family gets an email and a text.`)) e.preventDefault() }}
      className="space-y-2"
    >
      <input type="hidden" name="cycle" value={cycle} />
      <button disabled={pending || count === 0} className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
        {pending ? 'Releasing…' : `Release ${count} approved report${count === 1 ? '' : 's'}`}
      </button>
      {state.message && <p role="status" className="text-sm">{state.message}</p>}
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    </form>
  )
}
