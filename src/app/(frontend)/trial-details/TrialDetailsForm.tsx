'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Fieldset, Input } from '@/components/forms/Field'
import { CampMedical } from '@/components/forms/PlayerFields'
import { saveTrialDetails, type TrialDetailsState } from './actions'

/** Emergency contact + medical answer + photo consent for a free trial (after booking). */
export function TrialDetailsForm({ token, player, saved, academy }: { token: string; player: string; saved?: Record<string, string>; academy?: boolean }) {
  const [state, action] = useActionState<TrialDetailsState, FormData>(saveTrialDetails, {})
  const v = state.values ?? saved ?? {}
  if (state.done)
    return (
      <p role="status" data-trial-details="saved" className={`panel border border-line bg-surface-2 p-5 text-sm ${academy ? '' : 'rounded-2xl'}`}>
        <strong>Thanks — {player}’s details are saved.</strong> See you at the trial.
      </p>
    )
  return (
    <form action={action} data-trial-details="form" className="space-y-5 text-left">
      <input type="hidden" name="token" value={token} />
      <Fieldset legend={`${player}’s emergency contact`}>
        <Input label="Emergency contact name" name="emergencyName" required defaultValue={v.emergencyName} />
        <Input label="Relationship (optional)" name="emergencyRelationship" placeholder="e.g. Grandparent" defaultValue={v.emergencyRelationship} />
        <Input label="Emergency contact phone" name="emergencyPhone" type="tel" required defaultValue={v.emergencyPhone} />
        <CampMedical n={(x) => x} saved={{ answer: v.medicalAnswer ?? '', text: v.medical ?? '' }} hint="Conditions, allergies, medication and what to do. Shared only with the coaches." />
        <label className="flex items-start gap-3 text-sm sm:col-span-2">
          <input type="checkbox" name="photoConsent" defaultChecked={v.photoConsent === 'on'} className="mt-1 size-5" />
          <span>I consent to photos/video of {player} being used in club and Academy communications.</span>
        </label>
      </Fieldset>
      {state.error && <p role="alert" className="border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 [[data-brand=academy]_&]:text-red-300">{state.error}</p>}
      <Save academy={academy} />
    </form>
  )
}

function Save({ academy }: { academy?: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={`w-full px-6 py-4 text-sm font-semibold disabled:opacity-60 ${academy ? 'bg-white uppercase tracking-[0.18em] text-black hover:bg-white/85' : 'rounded-full bg-accent text-accent-ink hover:brightness-110'}`}>
      {pending ? 'Saving…' : 'Save details'}
    </button>
  )
}
