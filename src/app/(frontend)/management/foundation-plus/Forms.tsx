'use client'

import { useActionState } from 'react'
import { remindAction, saveChallengeAction, type FplusState } from './actions'

const input = 'mt-1 block w-full rounded-lg border border-line px-3 py-2'

export function RemindButton({ kid, disabled, label }: { kid: number; disabled: boolean; label: string }) {
  const [state, action, pending] = useActionState<FplusState, FormData>(remindAction, {})
  return (
    <form action={action}>
      <input type="hidden" name="kid" value={kid} />
      <button disabled={pending || disabled} className="rounded-full border border-line px-4 py-1.5 text-sm font-semibold hover:border-ink disabled:opacity-40">{pending ? 'Sending…' : label}</button>
      {(state.ok || state.error) && <p role={state.error ? 'alert' : 'status'} className={`mt-1 text-xs ${state.error ? 'text-red-700' : 'text-emerald-700'}`}>{state.error ?? state.ok}</p>}
    </form>
  )
}

export type ChallengeValues = { id?: number; title: string; month: string; description: string; rules: string; unit: string; direction: string; groupBy: string; winnersPerGroup: number; prize: string; published: boolean }

export function ChallengeForm({ v, locked }: { v: ChallengeValues; locked: boolean }) {
  const [state, action, pending] = useActionState<FplusState, FormData>(saveChallengeAction, {})
  return (
    <form action={action} className="space-y-4">
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <label className="text-sm font-semibold">Title<input name="title" required defaultValue={v.title} placeholder="e.g. 60-second juggling" className={input} /></label>
        <label className="text-sm font-semibold">Month<input name="month" type="month" required defaultValue={v.month} disabled={locked} className={input} />{locked && <input type="hidden" name="month" value={v.month} />}</label>
      </div>
      <label className="block text-sm font-semibold">The challenge<textarea name="description" required rows={3} defaultValue={v.description} placeholder="What to do, in one or two sentences." className={input} /></label>
      <label className="block text-sm font-semibold">How to film it<textarea name="rules" rows={3} defaultValue={v.rules} placeholder="Set-up, camera angle, what counts." className={input} /></label>
      <div className="grid gap-4 sm:grid-cols-4">
        <label className="text-sm font-semibold">Score unit<input name="unit" defaultValue={v.unit} placeholder="touches, seconds…" className={input} /></label>
        <label className="text-sm font-semibold">Best score is<select name="direction" defaultValue={v.direction} className={input}><option value="higher">Highest</option><option value="lower">Lowest (e.g. fastest)</option></select></label>
        <label className="text-sm font-semibold">Winners<select name="groupBy" defaultValue={v.groupBy} className={input}><option value="birthYear">One per year of birth</option><option value="all">Overall</option></select></label>
        <label className="text-sm font-semibold">Winners per group<input name="winnersPerGroup" type="number" min={1} max={10} defaultValue={v.winnersPerGroup} className={input} /></label>
      </div>
      <label className="block text-sm font-semibold">Prize<textarea name="prize" rows={2} defaultValue={v.prize} placeholder="e.g. Foundation+ hoodie + a free 1-on-1 session" className={input} /></label>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="published" defaultChecked={v.published} /> Live — Premium players can see it (the start email goes out on the 1st)</label>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? 'Saving…' : 'Save challenge'}</button>
    </form>
  )
}
