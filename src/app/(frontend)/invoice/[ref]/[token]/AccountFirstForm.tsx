'use client'

import { useActionState, useState } from 'react'
import { Input, PasswordInput } from '@/components/forms/Field'
import { CONSENT_WORDING } from '@/lib/consent-wording'
import { createAccountAndPay, type PayInvoiceState } from './actions'

/** Step 1 for families without an account: create it here, then go straight to the card payment. */
export function AccountFirstForm(props: { refCode: string; token: string; email?: string | null; firstName?: string; lastName?: string; mobile?: string | null; payLabel: string; academy: boolean }) {
  const [state, action, pending] = useActionState<PayInvoiceState, FormData>(createAccountAndPay, {})
  const [check, setCheck] = useState<string | null>(null)
  // Checked here first so a mistake doesn't clear the form
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const f = new FormData(e.currentTarget)
    const pw = String(f.get('password') ?? '')
    const msg = pw.length < 8 ? 'Please choose a password of at least 8 characters.' : pw !== String(f.get('confirm') ?? '') ? 'The passwords don’t match.' : f.get('serviceConsent') !== 'on' ? 'Please agree to receive service messages — we need these to manage your bookings and account.' : null
    setCheck(msg)
    if (msg) e.preventDefault()
  }
  const error = check ?? state.error
  return (
    <form action={action} onSubmit={onSubmit} className="space-y-4" aria-label="Create your account">
      <input type="hidden" name="ref" value={props.refCode} />
      <input type="hidden" name="token" value={props.token} />
      {props.email
        ? <div className="rounded-lg bg-surface px-4 py-3 text-sm"><span className="text-muted">Email</span> <strong className="ml-2 break-all">{props.email}</strong></div>
        : <Input label="Email" name="email" type="email" autoComplete="email" required />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <Input label="First name" name="firstName" autoComplete="given-name" required defaultValue={props.firstName ?? ''} />
        <Input label="Last name" name="lastName" autoComplete="family-name" required defaultValue={props.lastName ?? ''} />
      </div>
      <Input label="Mobile" name="mobile" type="tel" autoComplete="tel" placeholder="0412 345 678" defaultValue={props.mobile ?? ''} />
      <PasswordInput label="Password" name="password" autoComplete="new-password" minLength={8} required />
      <PasswordInput label="Confirm password" name="confirm" autoComplete="new-password" minLength={8} required />
      <label className="flex items-start gap-3 text-xs">
        <input type="checkbox" name="serviceConsent" className="mt-0.5" />
        <span>{CONSENT_WORDING.service} <span className="text-red-600">*</span></span>
      </label>
      <label className="flex items-start gap-3 text-xs">
        <input type="checkbox" name="marketingOptIn" className="mt-0.5" />
        <span>{CONSENT_WORDING.marketingSignupOptIn} <span className="text-muted">(optional)</span></span>
      </label>
      {error && <p role="alert" className="rounded-xl border border-red-500/50 bg-red-500/10 p-4 text-sm">{error}</p>}
      <button disabled={pending} className={`w-full bg-accent px-6 py-4 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60 ${props.academy ? 'uppercase tracking-[0.18em]' : 'rounded-full'}`}>
        {pending ? 'Creating your account…' : `Create account & ${props.payLabel.toLowerCase()}`}
      </button>
    </form>
  )
}
