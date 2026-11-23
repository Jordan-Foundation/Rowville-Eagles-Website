'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Field, Fieldset, Input, inputCls } from '@/components/forms/Field'
import { seniorEnquiry, type EnquiryState } from './actions'

const TEAMS = [
  { value: 'men', label: 'Senior Men' },
  { value: 'reserves', label: 'Reserves' },
  { value: 'women', label: 'Senior Women' },
  { value: 'unsure', label: 'Not sure yet' },
]

function Submit() {
  const { pending } = useFormStatus()
  return <button disabled={pending} className="w-full rounded-full bg-accent px-6 py-3.5 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60 sm:w-auto">{pending ? 'Sending…' : 'Send enquiry'}</button>
}

export function EnquiryForm({ team, prefill }: { team?: string; prefill?: Record<string, string> }) {
  const [state, action] = useActionState<EnquiryState, FormData>(seniorEnquiry, {})
  const v = state.values ?? {}
  return (
    <form action={action} className="space-y-6" aria-label="Senior enquiry">
      <Fieldset legend="About you">
        <Input label="Full name" name="name" autoComplete="name" required defaultValue={v.name ?? prefill?.name} />
        <Input label="Email" name="email" type="email" autoComplete="email" required defaultValue={v.email ?? prefill?.email} />
        <Input label="Mobile" name="phone" type="tel" autoComplete="tel" required defaultValue={v.phone ?? prefill?.phone} />
        <Input label="Age" name="age" type="number" min={15} max={80} defaultValue={v.age} />
      </Fieldset>
      <Fieldset legend="Football">
        <Field label="Which team?">
          <select name="team" className={inputCls} defaultValue={v.team ?? team ?? ''} required>
            <option value="" disabled>Select…</option>
            {TEAMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Input label="Position (optional)" name="position" defaultValue={v.position} />
        <div className="sm:col-span-2"><Input label="Previous club / level (optional)" name="previousClub" defaultValue={v.previousClub} /></div>
        <div className="sm:col-span-2">
          <Field label="Anything else? (optional)">
            <textarea name="message" rows={4} className={inputCls} defaultValue={v.message} placeholder="Experience, availability, questions…" />
          </Field>
        </div>
      </Fieldset>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {state.error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <Submit />
        <p className="text-sm text-muted">Goes straight to the club secretary, who’ll reply by email or phone.</p>
      </div>
    </form>
  )
}
