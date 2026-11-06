'use client'

import { useActionState } from 'react'
import { Input } from '@/components/forms/Field'
import { CONSENT_WORDING } from '@/lib/consent-wording'
import { createAccountFromInvite, type ConsentFormState } from './consent-actions'

export function CreateAccountForm(props: { invite: string; email: string; firstName?: string | null; lastName?: string | null; mobile?: string | null }) {
  const [state, action, pending] = useActionState<ConsentFormState, FormData>(createAccountFromInvite, {})
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="invite" value={props.invite} />
      <div className="rounded-lg bg-surface-2 px-4 py-3 text-sm">
        <span className="text-muted">Email</span> <strong className="ml-2">{props.email}</strong>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="First name" name="firstName" autoComplete="given-name" required defaultValue={props.firstName ?? ''} />
        <Input label="Last name" name="lastName" autoComplete="family-name" required defaultValue={props.lastName ?? ''} />
      </div>
      <Input label="Mobile" name="mobile" type="tel" autoComplete="tel" placeholder="0412 345 678" defaultValue={props.mobile ?? ''} hint="For session reminders and messages from your coach." />
      <Input label="Password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      <Input label="Confirm password" name="confirm" type="password" autoComplete="new-password" minLength={8} required />

      <fieldset className="space-y-3 rounded-2xl border border-line p-5">
        <legend className="px-1 text-sm font-semibold">Messages from us</legend>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="serviceConsent" required className="mt-1" />
          <span>
            {CONSENT_WORDING.service} <span className="text-red-600">*</span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-lg bg-surface-2 p-4 text-sm">
          <input type="checkbox" name="marketingOptIn" className="mt-1" />
          <span>
            {CONSENT_WORDING.marketingSignupOptIn} <span className="text-muted">(optional)</span>
          </span>
        </label>
      </fieldset>

      {state.error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-full bg-brand px-6 py-3.5 font-semibold text-white hover:brightness-110 disabled:opacity-60">
        {pending ? 'Creating your account…' : 'Create account'}
      </button>
    </form>
  )
}
