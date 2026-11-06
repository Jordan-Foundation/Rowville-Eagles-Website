'use client'

import { useActionState } from 'react'
import { savePreferences, type ConsentFormState } from '../consent-actions'

export function PreferencesForm({ marketingEmail, marketingSms, smsOptOut }: { marketingEmail: boolean; marketingSms: boolean; smsOptOut: boolean }) {
  const [state, action, pending] = useActionState<ConsentFormState, FormData>(savePreferences, {})
  return (
    <form action={action} className="space-y-4">
      <Toggle name="marketingEmail" label="Club news, offers & programs by email" defaultChecked={marketingEmail} />
      <Toggle
        name="marketingSms"
        label="Club news, offers & programs by SMS"
        defaultChecked={marketingSms}
        note={smsOptOut ? 'You replied STOP, so we can’t text you at all. Text START to our number to turn SMS back on.' : undefined}
      />
      {state.saved && <p role="status" className="rounded-lg bg-accent/15 px-4 py-3 text-sm">Saved — your preferences apply straight away.</p>}
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className="rounded-full bg-brand px-6 py-3 font-semibold text-white hover:brightness-110 disabled:opacity-60">
        {pending ? 'Saving…' : 'Save preferences'}
      </button>
    </form>
  )
}

function Toggle({ name, label, defaultChecked, note }: { name: string; label: string; defaultChecked: boolean; note?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-6 rounded-2xl border border-line p-5">
      <span>
        <span className="font-medium">{label}</span>
        {note && <span className="mt-1 block text-sm text-muted">{note}</span>}
      </span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span aria-hidden className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-line transition peer-checked:bg-brand after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-accent" />
    </label>
  )
}
