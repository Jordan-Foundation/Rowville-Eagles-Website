'use client'

import { useActionState } from 'react'
import { groupRunningLate, type GroupDecisionState } from '../../actions'

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
