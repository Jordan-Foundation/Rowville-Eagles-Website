'use client'

import { useActionState } from 'react'
import { saveProgram, type ProgramEditState } from './actions'

const input = 'mt-1 block w-full min-h-10 border border-line bg-black/40 px-3'
type P = Record<string, string | number | null | undefined> & { id: number }

export function ProgramForm({ prog }: { prog: P }) {
  const [state, action, pending] = useActionState<ProgramEditState, FormData>(saveProgram, {})
  const v = (k: string) => (prog[k] ?? '') as string | number
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={prog.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">Name<input name="title" defaultValue={v('title')} required className={input} /></label>
        <label className="text-sm">Status
          <select name="status" defaultValue={v('status')} className={input}>
            <option value="draft">Draft (hidden)</option><option value="open">Open for bookings</option><option value="full">Full / waitlist</option><option value="closed">Closed</option>
          </select>
        </label>
        <label className="text-sm">Places (empty = no limit)<input name="capacity" type="number" min={0} defaultValue={v('capacity')} className={input} /></label>
        <label className="text-sm sm:col-span-2">Short summary (cards and search results)<textarea name="summary" rows={2} maxLength={400} defaultValue={v('summary')} className={`${input} py-2`} /></label>
        <label className="text-sm">Where<input name="location" defaultValue={v('location')} placeholder="Home ground, or a full address" className={input} /></label>
        <label className="text-sm">Schedule<input name="scheduleNote" defaultValue={v('scheduleNote')} placeholder="3 days · 9am–3pm" className={input} /></label>
        <label className="text-sm">Ages (shown)<input name="ageRange" defaultValue={v('ageRange')} placeholder="Ages 5–13" className={input} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Min age<input name="minAge" type="number" min={0} defaultValue={v('minAge')} className={input} /></label>
          <label className="text-sm">Max age<input name="maxAge" type="number" min={0} defaultValue={v('maxAge')} className={input} /></label>
        </div>
        <label className="text-sm">What to bring<textarea name="whatToBring" rows={3} defaultValue={v('whatToBring')} className={`${input} py-2`} /></label>
        <label className="text-sm">Drop-off &amp; pick-up<textarea name="dropOffPickUp" rows={3} defaultValue={v('dropOffPickUp')} className={`${input} py-2`} /></label>
        <label className="text-sm sm:col-span-2">Price note (under the price)<input name="priceNote" defaultValue={v('priceNote')} placeholder="Sibling discount applied at checkout" className={input} /></label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="min-h-11 bg-white px-5 text-sm font-semibold uppercase tracking-[0.12em] text-black disabled:opacity-60">{pending ? 'Saving…' : 'Save program'}</button>
        {state.saved && <span role="status" className="text-sm text-emerald-300">{state.saved}</span>}
        {state.error && <span role="alert" className="text-sm text-red-300">{state.error}</span>}
      </div>
    </form>
  )
}
