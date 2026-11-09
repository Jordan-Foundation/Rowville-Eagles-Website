'use client'

import { useActionState } from 'react'
import { emailMeSummary, type SummaryState } from '@/app/(frontend)/management/summary-actions'

export function EmailMeSummary() {
  const [state, action, pending] = useActionState<SummaryState>(emailMeSummary, {})
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button disabled={pending} className="text-xs font-semibold underline disabled:opacity-60">{pending ? 'Sending…' : 'Email me this summary'}</button>
      {state.done && <span role="status" className="text-xs text-emerald-300">{state.done}</span>}
      {state.error && <span role="alert" className="text-xs text-red-300">{state.error}</span>}
    </form>
  )
}
