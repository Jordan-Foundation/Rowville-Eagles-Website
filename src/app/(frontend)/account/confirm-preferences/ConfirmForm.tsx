'use client'

import { useActionState } from 'react'
import { CONSENT_WORDING } from '@/lib/consent-wording'
import { confirmPreferencesFromEmail, type ConsentFormState } from '../consent-actions'

export function ConfirmForm({ invite }: { invite: string }) {
  const [state, action, pending] = useActionState<ConsentFormState, FormData>(confirmPreferencesFromEmail, {})
  if (state.saved) {
    return <p className="rounded-2xl bg-accent/15 p-6 text-center">Thanks — your preferences are saved. You can change them any time from your account.</p>
  }
  return (
    <form action={action} className="space-y-4 text-sm">
      <input type="hidden" name="invite" value={invite} />
      <label className="flex items-start gap-3 rounded-2xl border border-line p-5">
        <input type="checkbox" name="serviceConsent" required className="mt-1" />
        <span>
          {CONSENT_WORDING.service} <span className="text-red-600">*</span>
        </span>
      </label>
      <div className="space-y-3 rounded-2xl border border-line p-5">
        <p className="font-medium">Would you also like programs, offers and rewards?</p>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="marketingEmail" className="mt-1" />
          <span>{CONSENT_WORDING.marketingEmailOptIn}</span>
        </label>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="marketingSms" className="mt-1" />
          <span>{CONSENT_WORDING.marketingSmsOptIn}</span>
        </label>
      </div>
      {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-full bg-brand px-6 py-3.5 font-semibold text-white hover:brightness-110 disabled:opacity-60">
        {pending ? 'Saving…' : 'Save my preferences'}
      </button>
    </form>
  )
}
