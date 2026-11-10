'use client'

import { useActionState } from 'react'
import { groupDecisionAction, groupRunningLate, type GroupDecisionState } from '../../actions'

/** Running late for the whole group — every family gets a message. */
export function GroupLate({ groupId, at }: { groupId: number; at: string }) {
  const [state, action, pending] = useActionState<GroupDecisionState, FormData>(groupRunningLate, {})
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="group" value={groupId} />
      <input type="hidden" name="at" value={at} />
      <span className="text-muted">Running late? Tell every family:</span>
      {[5, 10, 15, 20].map((m) => (
        <button key={m} name="minutes" value={m} disabled={pending} className="border border-line px-3 py-1.5 text-xs font-semibold uppercase tracking-wider disabled:opacity-50">{m} min</button>
      ))}
      {state.error && <p role="alert" className="w-full text-red-300">{state.error}</p>}
      {state.done && <p role="status" className="w-full text-emerald-300">{state.done}</p>}
    </form>
  )
}

/** "Need cover" for this group session — every player's session is flagged and the Academy is told. */
export function GroupNeedCover({ groupId, at }: { groupId: number; at: string }) {
  const [state, action, pending] = useActionState<GroupDecisionState, FormData>(groupDecisionAction, {})
  if (state.done) return <p role="status" className="text-sm text-emerald-300">{state.done}</p>
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted">Can’t make it? Ask for cover</summary>
      <form action={action} className="mt-3 space-y-3 border border-line p-4">
        <input type="hidden" name="group" value={groupId} />
        <input type="hidden" name="at" value={at} />
        <label className="block">Handover notes for the cover coach<textarea name="note" rows={3} className="mt-1 block w-full border border-line bg-black/40 px-3 py-2 text-sm" placeholder="What the group is working on, anything to watch for." /></label>
        <button name="do" value="need-cover" disabled={pending} className="border border-line px-3 py-1.5 text-xs font-semibold uppercase tracking-wider disabled:opacity-50">Ask for cover</button>
        {state.error && <p role="alert" className="text-red-300">{state.error}</p>}
      </form>
    </details>
  )
}
