'use client'

import { useActionState } from 'react'
import { Field, Input, inputCls } from '@/components/forms/Field'
import { savePlayer, type PlayerFormState } from './actions'

type Props = {
  id: number
  values: { currentClub: string; position: string; goals: string; conditions: string; emergencyContact: string; emergencyPhone: string; photoConsent: boolean }
}

export function PlayerForm({ id, values: v }: Props) {
  const [state, action, pending] = useActionState<PlayerFormState, FormData>(savePlayer, {})
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Current club" name="currentClub" defaultValue={v.currentClub} />
        <Input label="Position" name="position" defaultValue={v.position} placeholder="e.g. Winger, Goalkeeper" />
      </div>
      <Field label="Main goals" hint="Your coach sees this before each session.">
        <textarea name="goals" rows={2} className={inputCls} defaultValue={v.goals} />
      </Field>
      <Field label="Medical or injury notes" hint="Shared only with your player’s coaches and Academy staff.">
        <textarea name="conditions" rows={2} className={inputCls} defaultValue={v.conditions} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Emergency contact" name="emergencyContact" required defaultValue={v.emergencyContact} />
        <Input label="Emergency phone" name="emergencyPhone" type="tel" required defaultValue={v.emergencyPhone} />
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="photoConsent" defaultChecked={v.photoConsent} className="mt-1" />
        <span>Photos/video of this player may be used in club and Academy communications.</span>
      </label>
      {state.error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">{state.error}</p>}
      {state.saved && <p role="status" className="rounded-lg border border-accent bg-accent/10 px-4 py-3 text-sm">Saved — coaches will see the update.</p>}
      <button type="submit" disabled={pending} className="rounded-full bg-brand px-6 py-3 font-semibold text-white hover:brightness-110 disabled:opacity-60">
        {pending ? 'Saving…' : 'Save details'}
      </button>
    </form>
  )
}
