'use client'

import { useActionState } from 'react'
import { Input } from '@/components/forms/Field'
import { requestReset, type FormState } from '../actions'

export function ForgotForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestReset, {})
  if (state.done) return <p className="rounded-lg bg-surface-2 p-4 text-center text-sm">If there’s an account for that email, we’ve sent a link to reset the password.</p>
  return (
    <form action={action} className="space-y-4">
      <Input label="Email" name="email" type="email" autoComplete="email" required />
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-full bg-brand px-6 py-3.5 font-semibold text-white hover:brightness-110 disabled:opacity-60">Email me a link</button>
    </form>
  )
}
