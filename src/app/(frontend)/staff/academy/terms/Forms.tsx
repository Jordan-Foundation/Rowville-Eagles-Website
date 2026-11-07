'use client'

import { useActionState } from 'react'
import { cancelRegistration, offerPlace, type TermStaffState } from './actions'

const ghost = 'rounded-full border border-line px-3 py-1 text-xs font-semibold hover:border-brand disabled:opacity-50'

export function OfferForm({ reg, options, again }: { reg: number; options: { id: number; label: string; fits: boolean }[]; again?: boolean }) {
  const [state, action, pending] = useActionState<TermStaffState, FormData>(offerPlace, {})
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="reg" value={reg} />
      <select name="slot" required defaultValue={options.find((o) => o.fits)?.id ?? ''} className="max-w-72 rounded-lg border border-line bg-surface px-2 py-1 text-xs" aria-label="Training time">
        <option value="" disabled>Choose a time…</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.fits ? '' : '⚠ other age group: '}{o.label}</option>)}
      </select>
      <label className="flex items-center gap-1 text-xs text-muted">hold <input name="days" type="number" min={1} max={30} defaultValue={7} className="w-12 rounded border border-line bg-surface px-1 py-0.5" /> days</label>
      <button disabled={pending} className={ghost}>{pending ? 'Sending…' : again ? 'Resend offer' : 'Offer place'}</button>
      {state.error && <span role="alert" className="text-xs text-red-600">{state.error}</span>}
      {state.done && <span role="status" className="text-xs text-emerald-700">{state.done}</span>}
    </form>
  )
}

export function CancelForm({ reg }: { reg: number }) {
  const [state, action, pending] = useActionState<TermStaffState, FormData>(cancelRegistration, {})
  return (
    <form action={action} onSubmit={(e) => { if (!confirm('Cancel this registration? The family is not emailed.')) e.preventDefault() }} className="inline-flex items-center gap-2">
      <input type="hidden" name="reg" value={reg} />
      <button disabled={pending} className={ghost}>Cancel</button>
      {state.error && <span role="alert" className="text-xs text-red-600">{state.error}</span>}
    </form>
  )
}
