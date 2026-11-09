'use client'

import { useActionState, useState } from 'react'
import { coachesAction, groupsAction, type TermStaffState } from './actions'

const ghost = 'rounded-full border border-line px-3 py-1 text-xs font-semibold hover:border-brand disabled:opacity-50'
const Msg = ({ s }: { s: TermStaffState }) => (
  <>
    {s.error && <span role="alert" className="text-xs text-red-700">{s.error}</span>}
    {s.done && <span role="status" className="text-xs text-emerald-700">{s.done}</span>}
  </>
)

/** Pick coaches for a whole training time (no groupId) or one group. */
export function CoachPicker({ slot, groupId, coaches, chosen, clashes }: { slot: number; groupId?: string; coaches: { id: number; name: string }[]; chosen: number[]; clashes: string[] }) {
  const [state, action, pending] = useActionState<TermStaffState, FormData>(coachesAction, {})
  const [open, setOpen] = useState(false)
  const names = coaches.filter((c) => chosen.includes(c.id)).map((c) => c.name)
  return (
    <div className="text-sm">
      <p>
        <span className="text-muted">Coach{names.length === 1 ? '' : 'es'}:</span> {names.length ? names.join(', ') : <span className="text-amber-800">none yet</span>}{' '}
        <button type="button" onClick={() => setOpen((o) => !o)} className="ml-1 text-xs underline">{open ? 'close' : 'change'}</button>
      </p>
      {clashes.map((c) => <p key={c} className="text-xs font-semibold text-amber-800">⚠ {c}</p>)}
      {open && (
        <form action={action} className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
          <input type="hidden" name="slot" value={slot} />
          {groupId && <input type="hidden" name="groupId" value={groupId} />}
          {coaches.map((c) => (
            <label key={c.id} className="flex items-center gap-1.5"><input type="checkbox" name="coaches" value={c.id} defaultChecked={chosen.includes(c.id)} /> {c.name}</label>
          ))}
          <label className="flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" name="notify" defaultChecked /> tell paid families</label>
          <button disabled={pending} className={ghost}>{pending ? 'Saving…' : 'Save coaches'}</button>
          <Msg s={state} />
        </form>
      )}
      {!open && <Msg s={state} />}
    </div>
  )
}

export function AddGroup({ slot }: { slot: number }) {
  const [state, action, pending] = useActionState<TermStaffState, FormData>(groupsAction, {})
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="slot" value={slot} />
      <input name="name" aria-label="New group name" required placeholder="New group, e.g. Group A" className="w-44 rounded-lg border border-line bg-surface px-2 py-1 text-xs" />
      <button disabled={pending} className={ghost}>Add group</button>
      <Msg s={state} />
    </form>
  )
}

export function RemoveGroup({ slot, groupId }: { slot: number; groupId: string }) {
  const [state, action, pending] = useActionState<TermStaffState, FormData>(groupsAction, {})
  return (
    <form action={action} onSubmit={(e) => { if (!confirm('Remove this group? Its players stay in the training time.')) e.preventDefault() }} className="inline-flex items-center gap-2">
      <input type="hidden" name="slot" value={slot} />
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="op" value="remove" />
      <button disabled={pending} className={ghost}>Remove group</button>
      <Msg s={state} />
    </form>
  )
}
