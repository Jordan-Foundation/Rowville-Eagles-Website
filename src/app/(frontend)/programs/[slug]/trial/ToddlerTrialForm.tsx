'use client'

import { KidQuickFill } from '@/components/forms/KidQuickFill'
import type { KidOption } from '@/lib/family-kids'
import { PolicyLink } from '@/components/PolicyLink'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Fieldset, Input } from '@/components/forms/Field'
import type { ToddlerTrialSession } from '@/academy/terms/toddler-data'
import { bookToddlerTrial, type ToddlerTrialState } from './actions'

export function ToddlerTrialForm({ slug, sessions, kids = [], prefill }: { slug: string; sessions: ToddlerTrialSession[]; kids?: KidOption[]; prefill?: Record<string, string> }) {
  const [state, action] = useActionState<ToddlerTrialState, FormData>(bookToddlerTrial, {})
  const v = state.values ?? {}
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="program" value={slug} />
      <Fieldset legend="Your child">
        <KidQuickFill kids={kids} />
        <Input label="First name" name="playerFirstName" required defaultValue={v.playerFirstName} />
        <Input label="Last name" name="playerLastName" required defaultValue={v.playerLastName} />
        <Input label="Date of birth" name="playerDob" type="date" required defaultValue={v.playerDob} />
        <p className="self-end text-sm text-muted">Ages 2–5 on the day of the session.</p>
      </Fieldset>
      <fieldset className="rounded-2xl border border-line bg-surface-2 p-6">
        <legend className="px-2 font-display text-lg font-semibold uppercase tracking-wide">Choose a session</legend>
        <div className="grid max-h-[26rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {sessions.map((n) => (
            <label key={n.start} className={`flex cursor-pointer items-center justify-between gap-3 border border-line bg-surface px-4 py-3 text-sm transition has-[:checked]:border-brand has-[:checked]:ring-1 has-[:checked]:ring-brand ${n.left === 0 ? 'pointer-events-none opacity-35' : 'hover:border-brand'}`}>
              <span className="flex items-center gap-3">
                <input type="radio" name="session" value={n.start} required disabled={n.left === 0} defaultChecked={v.session === n.start} className="accent-[var(--color-brand)]" />
                {n.label}
              </span>
              <span className="text-xs uppercase tracking-wider text-muted">{n.left === 0 ? 'Full' : `${n.left} spot${n.left === 1 ? '' : 's'}`}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Fieldset legend="Parent / guardian">
        <Input label="First name" name="contactFirstName" autoComplete="given-name" required defaultValue={v.contactFirstName ?? prefill?.contactFirstName} />
        <Input label="Last name" name="contactLastName" autoComplete="family-name" required defaultValue={v.contactLastName ?? prefill?.contactLastName} />
        <Input label="Email" name="contactEmail" type="email" autoComplete="email" required defaultValue={v.contactEmail ?? prefill?.contactEmail} />
        <Input label="Mobile" name="contactPhone" type="tel" autoComplete="tel" required defaultValue={v.contactPhone ?? prefill?.contactPhone} />
        <p className="text-sm text-muted sm:col-span-2">You’ll add an emergency contact and any medical information straight after booking.</p>
      </Fieldset>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="terms" required defaultChecked={v.terms === 'on'} className="mt-0.5 size-5 shrink-0" />
        <span>I’ll stay at the session to supervise my child, and I agree to the club’s <PolicyLink k="childSafe">Child Safe policy</PolicyLink> and <PolicyLink k="refunds">terms</PolicyLink>.</span>
      </label>
      {state.error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">{state.error}</p>}
      <Submit />
    </form>
  )
}

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="w-full rounded-full bg-accent px-6 py-4 text-sm font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60">
      {pending ? 'Booking…' : 'Book free trial'}
    </button>
  )
}
