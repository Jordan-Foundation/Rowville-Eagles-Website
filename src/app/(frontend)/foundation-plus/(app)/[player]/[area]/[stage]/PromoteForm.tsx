'use client'

import { useActionState } from 'react'
import { promoteAction, type PromoteState } from '../../../actions'

export function PromoteForm({ player, stage, path, unit }: { player: number; stage: number; path: string; unit: string }) {
  const [state, action, pending] = useActionState<PromoteState, FormData>(promoteAction, {})
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 text-sm">
      <input type="hidden" name="player" value={player} />
      <input type="hidden" name="stage" value={stage} />
      <input type="hidden" name="path" value={path} />
      <label>Score seen{unit ? ` (${unit})` : ''} <span className="text-muted">optional</span><input name="score" type="number" step="any" min={0} className="mt-1 block w-28 border border-line bg-black/40 px-2 py-1.5" /></label>
      <label>Date<input name="date" type="date" defaultValue={today} max={today} className="mt-1 block border border-line bg-black/40 px-2 py-1.5" /></label>
      <label className="min-w-48 flex-1">Note <span className="text-muted">optional</span><input name="note" placeholder="e.g. Seen at Tuesday training" className="mt-1 block w-full border border-line bg-black/40 px-2 py-1.5" /></label>
      <button disabled={pending} className="bg-white px-4 py-2 font-semibold text-black disabled:opacity-50">{pending ? 'Saving…' : 'Mark as passed'}</button>
      {state.error && <p role="alert" className="basis-full text-red-300">{state.error}</p>}
      {state.done && <p role="status" className="basis-full text-emerald-300">{state.done}</p>}
    </form>
  )
}
