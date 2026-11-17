'use client'

import { startTransition, useActionState } from 'react'
import { Input, PasswordInput } from '@/components/forms/Field'
import { WwccFields } from '@/components/forms/WwccFields'
import { withShrunkPhoto } from '@/components/forms/shrinkPhoto'
import { CONSENT_WORDING } from '@/lib/consent-wording'
import { completeCoachSetup, type CoachSetupState } from './actions'

export function CoachSetupForm(props: { invite: string; email: string; firstName?: string | null; lastName?: string | null; mobile?: string | null; existing: boolean }) {
  const [state, action, pending] = useActionState<CoachSetupState, FormData>(completeCoachSetup, {})
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = await withShrunkPhoto(e.currentTarget, 'wwccPhoto')
    startTransition(() => action(fd))
  }
  return (
    <form onSubmit={onSubmit} className="space-y-5" aria-label="Coach sign-up">
      <input type="hidden" name="invite" value={props.invite} />
      <div className="rounded-lg bg-surface-2 px-4 py-3 text-sm">
        <span className="text-muted">Email</span> <strong className="ml-2">{props.email}</strong>
      </div>
      {props.existing ? (
        <p className="text-sm text-muted">You already have an account with this email — add your WWCC below, then log in with your usual password.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="First name" name="firstName" autoComplete="given-name" required defaultValue={props.firstName ?? ''} />
            <Input label="Last name" name="lastName" autoComplete="family-name" required defaultValue={props.lastName ?? ''} />
          </div>
          <Input label="Mobile" name="mobile" type="tel" autoComplete="tel" required placeholder="0412 345 678" defaultValue={props.mobile ?? ''} hint="For session alerts, cover requests and reminders." />
          <PasswordInput label="Password" name="password" autoComplete="new-password" minLength={8} required />
          <PasswordInput label="Confirm password" name="confirm" autoComplete="new-password" minLength={8} required />
        </>
      )}
      <WwccFields />
      {!props.existing && (
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="serviceConsent" required className="mt-1" />
          <span>{CONSENT_WORDING.service} <span className="text-red-600">*</span></span>
        </label>
      )}
      {state.error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-full bg-brand px-6 py-3.5 font-semibold text-white hover:brightness-110 disabled:opacity-60">
        {pending ? 'Saving…' : props.existing ? 'Send my WWCC' : 'Create my coach account'}
      </button>
    </form>
  )
}
