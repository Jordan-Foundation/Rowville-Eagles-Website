'use client'

import { useActionState } from 'react'
import { Input } from '@/components/forms/Field'
import { requestLoginLink, type LinkState } from '../link-actions'

export function EmailLinkForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LinkState, FormData>(requestLoginLink, {})
  if (state.done) return <p role="status" className="rounded-lg bg-surface-2 p-4 text-center text-sm">If there’s an account for that email, we’ve sent a login link. It works once and expires in 20 minutes — check your junk folder if it hasn’t arrived.</p>
  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <Input label="Email" name="email" type="email" autoComplete="email" required />
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-full bg-brand px-6 py-3.5 font-semibold text-white hover:brightness-110 disabled:opacity-60">{pending ? 'Sending…' : 'Email me a login link'}</button>
    </form>
  )
}
