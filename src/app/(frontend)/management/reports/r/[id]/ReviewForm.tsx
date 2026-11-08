'use client'

import { useActionState, useState } from 'react'
import { RATINGS, RATING_LABEL } from '@/academy/curriculum/levels'
import { reviewAction, type CycleState } from '../../actions'

type Strand = { key: string; name: string; rating: string; comment: string }
const btn = 'rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-50'
const input = 'mt-1 block w-full rounded-lg border border-line px-3 py-2'

export function ReviewForm(props: { id: number; next: string; level: string; levels: { key: string; label: string }[]; strands: Strand[]; overall: string; canApprove: boolean; canReturn: boolean; returnNote: string }) {
  const [state, action, pending] = useActionState<CycleState, FormData>(reviewAction, {})
  const [returning, setReturning] = useState(false)
  return (
    <form action={action} className="mt-8 space-y-6">
      <input type="hidden" name="id" value={props.id} />
      <input type="hidden" name="next" value={props.next} />
      <div className="flex flex-wrap items-center gap-3">
        {props.canApprove && <button name="intent" value="approve" disabled={pending} className={`${btn} bg-emerald-600 text-white`}>Approve{props.next.includes('/r/') ? ' & next' : ''}</button>}
        {props.canReturn && <button type="button" onClick={() => setReturning((v) => !v)} className={`${btn} border border-line`}>Return to coach…</button>}
      </div>
      {returning && (
        <div className="rounded-2xl border border-amber-400 p-4">
          <label className="text-sm font-semibold">What should the coach change?
            <textarea name="note" rows={3} defaultValue={props.returnNote} className={input} placeholder="e.g. Please add a sentence about what to work on next." />
          </label>
          <button name="intent" value="return" disabled={pending} className={`${btn} mt-3 bg-amber-500 text-black`}>Return & email the coach</button>
        </div>
      )}
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state.message && <p role="status" className="text-sm">{state.message}</p>}

      <details className="rounded-2xl border border-line p-5">
        <summary className="cursor-pointer font-semibold">Edit the report</summary>
        <p className="mt-2 text-sm text-muted">Fix a typo, a rating or the level before approving. Changes are logged.</p>
        <label className="mt-4 block max-w-xs text-sm font-semibold">Level
          <select name="level" defaultValue={props.level} className={input}>{props.levels.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}</select>
        </label>
        <div className="mt-4 space-y-4">
          {props.strands.map((s) => (
            <fieldset key={s.key} className="grid gap-2 sm:grid-cols-[12rem_1fr]">
              <legend className="sr-only">{s.name}</legend>
              <label className="text-sm font-semibold">{s.name}
                <select name={`rating-${s.key}`} defaultValue={s.rating} className={input}>
                  <option value="">—</option>
                  {RATINGS.map((r) => <option key={r} value={r}>{RATING_LABEL[r]}</option>)}
                </select>
              </label>
              <label className="text-sm">Comment<textarea name={`comment-${s.key}`} rows={2} defaultValue={s.comment} className={input} /></label>
            </fieldset>
          ))}
        </div>
        <label className="mt-4 block text-sm font-semibold">Overall comment<textarea name="overall" rows={4} defaultValue={props.overall} className={input} /></label>
        <button name="intent" value="save" disabled={pending} className={`${btn} mt-4 bg-brand text-white`}>{pending ? 'Saving…' : 'Save changes'}</button>
      </details>
    </form>
  )
}
