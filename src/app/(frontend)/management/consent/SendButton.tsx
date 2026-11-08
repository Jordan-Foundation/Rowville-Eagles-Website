'use client'

import { useActionState } from 'react'
import { sendBatch, type BatchState } from './actions'

export function SendButton({ pending }: { pending: number }) {
  const [state, action, busy] = useActionState<BatchState>(sendBatch, {})
  return (
    <form action={action} className="space-y-3">
      <button
        type="submit"
        disabled={busy || pending === 0}
        className="rounded-full bg-brand px-6 py-3 font-semibold text-white hover:brightness-110 disabled:opacity-50"
        onClick={(e) => {
          if (!confirm(`Send the confirm-preferences email to up to 100 of the ${pending} members waiting? Each member only ever receives it once.`)) e.preventDefault()
        }}
      >
        {busy ? 'Sending…' : `Send to next ${Math.min(100, pending)} members`}
      </button>
      {state.sent !== undefined && <p role="status" className="text-sm">Sent {state.sent} emails.</p>}
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    </form>
  )
}
