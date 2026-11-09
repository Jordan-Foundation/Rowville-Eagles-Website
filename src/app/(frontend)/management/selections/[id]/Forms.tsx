'use client'

import { useActionState } from 'react'
import { createSquad, sendOutcomes, type BoardState } from '../actions'

const field = 'rounded-lg border border-line bg-surface px-3 py-2 text-sm'

export function SquadForm({ roundId, years }: { roundId: number; years: string }) {
  const [state, action, pending] = useActionState<BoardState, FormData>(createSquad, {})
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="roundId" value={roundId} />
      <input name="name" aria-label="Squad name" required placeholder="Squad name, e.g. 2016s Red" className={`${field} min-w-48 flex-1`} />
      <input name="years" aria-label="Years of birth" placeholder={`Years of birth, e.g. ${years}`} className={`${field} w-48`} />
      <input name="capacity" aria-label="Max players" type="number" min={1} placeholder="Max players" className={`${field} w-32`} />
      <input name="fee" aria-label="Fee" type="number" min={0} step="0.01" placeholder="Fee (optional)" className={`${field} w-36`} />
      <button disabled={pending} className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-brand">{pending ? 'Adding…' : 'Add squad'}</button>
      {state.error && <p role="alert" className="basis-full text-sm text-red-700">{state.error}</p>}
      {state.done && <p role="status" className="basis-full text-sm text-emerald-700">{state.done}</p>}
    </form>
  )
}

export function SendForm({ roundId, count }: { roundId: number; count: number }) {
  const [state, action, pending] = useActionState<BoardState, FormData>(sendOutcomes, {})
  return (
    <form action={action} className="rounded-2xl border-2 border-accent p-5">
      <input type="hidden" name="roundId" value={roundId} />
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="confirm" className="mt-1" />
        <span>I’ve checked these {count} outcomes and messages — send them now. (Families receive the emails{' '}and texts straight away; this can’t be undone.)</span>
      </label>
      {state.error && <p role="alert" className="mt-3 text-sm text-red-700">{state.error}</p>}
      <button disabled={pending || !count} className="mt-4 rounded-full bg-brand px-6 py-3 font-semibold text-white disabled:opacity-40">{pending ? 'Sending…' : `Send ${count} outcome${count === 1 ? '' : 's'}`}</button>
    </form>
  )
}
