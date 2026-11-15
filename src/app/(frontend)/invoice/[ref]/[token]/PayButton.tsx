'use client'

import { useActionState } from 'react'
import { payInvoice, type PayInvoiceState } from './actions'

export function PayButton({ refCode, token, label, academy }: { refCode: string; token: string; label: string; academy: boolean }) {
  const [state, action, pending] = useActionState<PayInvoiceState, FormData>(payInvoice, {})
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="ref" value={refCode} />
      <input type="hidden" name="token" value={token} />
      {state.error && <p role="alert" className="rounded-xl border border-red-500/50 bg-red-500/10 p-4 text-sm">{state.error}</p>}
      <button disabled={pending} className={`w-full bg-accent px-6 py-4 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60 ${academy ? 'uppercase tracking-[0.18em]' : 'rounded-full'}`}>
        {pending ? 'Opening secure payment…' : label}
      </button>
    </form>
  )
}
