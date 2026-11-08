'use client'

import { useActionState } from 'react'
import { PasswordInput } from '@/components/forms/Field'
import { activateAccount, type FormState } from './actions'

export function ActivateForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(activateAccount, {})
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <PasswordInput label="New password" name="password" autoComplete="new-password" minLength={8} required />
      <PasswordInput label="Confirm password" name="confirm" autoComplete="new-password" minLength={8} required />
      {state.error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-full bg-brand px-6 py-3.5 font-semibold text-white hover:brightness-110 disabled:opacity-60">
        {pending ? 'Saving…' : 'Save password & continue'}
      </button>
    </form>
  )
}
