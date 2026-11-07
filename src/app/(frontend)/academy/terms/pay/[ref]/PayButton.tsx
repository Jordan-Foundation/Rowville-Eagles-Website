'use client'

import { useActionState } from 'react'
import { payTerm } from './actions'

export function PayButton({ refCode, token, label }: { refCode: string; token?: string; label: string }) {
  const [state, action, pending] = useActionState(payTerm, {})
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="ref" value={refCode} />
      {token && <input type="hidden" name="t" value={token} />}
      <button disabled={pending} className="w-full rounded-full bg-accent px-6 py-4 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60 [[data-brand=academy]_&]:rounded-none [[data-brand=academy]_&]:uppercase [[data-brand=academy]_&]:tracking-[0.18em]">
        {pending ? 'Starting secure checkout…' : label}
      </button>
      {state.error && <p role="alert" className="text-sm text-red-500">{state.error}</p>}
    </form>
  )
}
