'use client'

import { useActionState, useState } from 'react'
import { groupDateAction, type GroupAdminState } from '../actions'

const field = 'mt-1 block w-full border border-line bg-black/40 px-3 py-2 text-sm'
const btn = 'border border-line px-3 py-1.5 text-xs font-semibold uppercase tracking-wider disabled:opacity-50'

/** Cancel, move or cover one date — for every player in the group at once. */
export function DateTools({ groupId, at, label, coaches, coverCoach }: { groupId: number; at: string; label: string; coaches: { id: number; name: string }[]; coverCoach?: number | null }) {
  const [state, action, pending] = useActionState<GroupAdminState, FormData>(groupDateAction, {})
  const [open, setOpen] = useState<'' | 'cancel' | 'move' | 'cover'>('')
  return (
    <div className="w-full">
      <div className="flex flex-wrap justify-end gap-2">
        {(['cover', 'move', 'cancel'] as const).map((k) => (
          <button key={k} type="button" onClick={() => setOpen(open === k ? '' : k)} aria-expanded={open === k} className={`${btn} ${k === 'cancel' ? 'text-red-200' : ''}`}>
            {k === 'cover' ? 'Cover' : k === 'move' ? 'Move' : 'Cancel date'}
          </button>
        ))}
      </div>
      {open && (
        <form action={action} className="mt-3 border border-line p-4 text-left text-sm" aria-label={`${open} ${label}`}>
          <input type="hidden" name="group" value={groupId} />
          <input type="hidden" name="at" value={at} />
          {open === 'cancel' && (
            <>
              <p>Cancel {label} for every player. Each family gets that session’s value back:</p>
              <div className="mt-2 flex gap-4">
                <label className="flex items-center gap-2"><input type="radio" name="outcome" value="refund" defaultChecked /> Refund to card</label>
                <label className="flex items-center gap-2"><input type="radio" name="outcome" value="credit" /> Small group credit</label>
              </div>
              <label className="mt-3 block">Reason (sent to families)<textarea name="reason" required rows={2} className={field} placeholder="Coach unwell." /></label>
              <button name="do" value="cancel" disabled={pending} className="mt-3 bg-red-500 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-50">Cancel this date for everyone</button>
            </>
          )}
          {open === 'move' && (
            <>
              <p>Move {label} for the whole group (the coach must be free).</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className="block">New date<input type="date" name="date" required className={field} /></label>
                <label className="block">New time<input type="time" name="time" required className={field} /></label>
              </div>
              <label className="mt-3 flex items-center gap-2"><input type="checkbox" name="notify" defaultChecked /> Email the families and the coach</label>
              <button name="do" value="move" disabled={pending} className="mt-3 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider text-black disabled:opacity-50">Move the whole group</button>
            </>
          )}
          {open === 'cover' && (
            <>
              <label className="block">Cover coach<select name="coverCoach" defaultValue={coverCoach ? String(coverCoach) : ''} className={field}><option value="">Not assigned yet</option>{coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label className="mt-3 flex items-center gap-2"><input type="checkbox" name="needsCover" defaultChecked /> The booked coach is away</label>
              <button name="do" value="cover" disabled={pending} className="mt-3 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider text-black disabled:opacity-50">Save cover</button>
            </>
          )}
        </form>
      )}
      {state.error && <p role="alert" className="mt-2 text-sm text-red-300">{state.error}</p>}
      {state.done && <p role="status" className="mt-2 text-sm text-emerald-300">{state.done}</p>}
    </div>
  )
}
