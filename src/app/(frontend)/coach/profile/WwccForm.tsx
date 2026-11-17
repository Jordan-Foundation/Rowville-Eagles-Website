'use client'

import { startTransition, useActionState } from 'react'
import { WwccFields } from '@/components/forms/WwccFields'
import { withShrunkPhoto } from '@/components/forms/shrinkPhoto'
import { saveMyWwcc, type WwccState } from './wwcc-actions'

export function WwccForm({ number, expiry, hasPhoto }: { number?: string | null; expiry?: string | null; hasPhoto: boolean }) {
  const [state, action, pending] = useActionState<WwccState, FormData>(saveMyWwcc, {})
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = await withShrunkPhoto(e.currentTarget, 'wwccPhoto')
    startTransition(() => action(fd))
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4" aria-label="Working With Children Check">
      <WwccFields number={number} expiry={expiry} hasPhoto={hasPhoto} />
      {state.error && <p role="alert" className="border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{state.error}</p>}
      {state.saved && <p role="status" className="text-sm">Thanks — your WWCC has been sent to Management to check.</p>}
      <button type="submit" disabled={pending} className="min-h-11 bg-white px-5 text-xs font-semibold uppercase tracking-[0.12em] text-black disabled:opacity-60">{pending ? 'Sending…' : 'Save WWCC'}</button>
    </form>
  )
}
