'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Field, Fieldset, Input, inputCls } from '@/components/forms/Field'
import type { ToddlerTrialSession } from '@/academy/terms/toddler-data'
import { bookToddlerTrial, type ToddlerTrialState } from './actions'

export function ToddlerTrialForm({ slug, sessions }: { slug: string; sessions: ToddlerTrialSession[] }) {
  const [state, action] = useActionState<ToddlerTrialState, FormData>(bookToddlerTrial, {})
  const v = state.values ?? {}
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="program" value={slug} />
      <Fieldset legend="Your child">
        <Input label="First name" name="playerFirstName" required defaultValue={v.playerFirstName} />
        <Input label="Last name" name="playerLastName" required defaultValue={v.playerLastName} />
        <Input label="Date of birth" name="playerDob" type="date" required defaultValue={v.playerDob} />
        <p className="self-end text-sm text-muted">Ages 2–5 on the day of the session.</p>
      </Fieldset>
      <fieldset className="panel rounded-sm border border-line bg-surface-2 p-6">
        <legend className="px-2 font-display text-lg font-semibold uppercase tracking-wide">Choose a session</legend>
        <div className="grid max-h-[26rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {sessions.map((n) => (
            <label key={n.start} className={`flex cursor-pointer items-center justify-between gap-3 border border-line bg-surface px-4 py-3 text-sm transition has-[:checked]:border-white has-[:checked]:ring-1 has-[:checked]:ring-white ${n.left === 0 ? 'pointer-events-none opacity-35' : 'hover:border-white/40'}`}>
              <span className="flex items-center gap-3">
                <input type="radio" name="session" value={n.start} required disabled={n.left === 0} defaultChecked={v.session === n.start} className="accent-white" />
                {n.label}
              </span>
              <span className="text-xs uppercase tracking-wider text-muted">{n.left === 0 ? 'Full' : `${n.left} spot${n.left === 1 ? '' : 's'}`}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Fieldset legend="Parent / guardian">
        <Input label="First name" name="contactFirstName" autoComplete="given-name" required defaultValue={v.contactFirstName} />
        <Input label="Last name" name="contactLastName" autoComplete="family-name" required defaultValue={v.contactLastName} />
        <Input label="Email" name="contactEmail" type="email" autoComplete="email" required defaultValue={v.contactEmail} />
        <Input label="Mobile" name="contactPhone" type="tel" autoComplete="tel" required defaultValue={v.contactPhone} />
        <div className="sm:col-span-2">
          <Field label="Medical conditions, allergies or anything we should know">
            <textarea name="medical" rows={2} className={inputCls} defaultValue={v.medical} />
          </Field>
        </div>
        <Input label="Emergency contact name" name="emergencyName" required defaultValue={v.emergencyName} />
        <Input label="Emergency contact phone" name="emergencyPhone" type="tel" required defaultValue={v.emergencyPhone} />
        <label className="flex items-start gap-3 text-sm sm:col-span-2">
          <input type="checkbox" name="photoConsent" defaultChecked={v.photoConsent === 'on'} className="mt-1" />
          <span>I consent to photos/video of my child being used in Academy communications.</span>
        </label>
      </Fieldset>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="terms" required defaultChecked={v.terms === 'on'} className="mt-1" />
        <span>I’ll stay at the session to supervise my child, and I agree to the Academy’s Child Safe policy and terms.</span>
      </label>
      {state.error && <p role="alert" className="border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{state.error}</p>}
      <Submit />
    </form>
  )
}

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="w-full bg-white px-6 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-black transition hover:bg-white/85 disabled:opacity-60">
      {pending ? 'Booking…' : 'Book free trial'}
    </button>
  )
}
