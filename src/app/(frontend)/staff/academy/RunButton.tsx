'use client'

import { useActionState } from 'react'
import { runRemindersNow, type RunState } from './actions'

export function RunButton() {
  const [state, action, busy] = useActionState<RunState>(runRemindersNow, {})
  return (
    <form action={action} className="flex flex-wrap items-center gap-4">
      <button type="submit" disabled={busy} className="bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-black hover:bg-white/85 disabled:opacity-50">
        {busy ? 'Checking…' : 'Send due reminders now'}
      </button>
      {state.sent !== undefined && <p role="status" className="text-sm">{state.sent === 0 ? 'No reminders due right now.' : `Sent ${state.sent} reminder${state.sent === 1 ? '' : 's'}.`}</p>}
      {state.error && <p role="alert" className="text-sm text-red-300">{state.error}</p>}
    </form>
  )
}
