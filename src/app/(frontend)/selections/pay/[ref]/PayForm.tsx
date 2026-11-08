'use client'

import { PolicyLink } from '@/components/PolicyLink'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Field, Fieldset, Input, inputCls } from '@/components/forms/Field'
import { payForSelection, type PayState } from './actions'

export function PayForm({ refCode, token, price, defaults }: { refCode: string; token?: string; price: string; defaults: { medical?: string; emergencyName?: string; emergencyPhone?: string; photoConsent?: boolean } }) {
  const [state, action] = useActionState<PayState, FormData>(payForSelection, {})
  const v = state.values ?? {}
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="ref" value={refCode} />
      {token && <input type="hidden" name="t" value={token} />}
      <Fieldset legend="Player details">
        <div className="sm:col-span-2">
          <Field label="Medical conditions, allergies or injuries" hint="Shared only with coaches and team managers.">
            <textarea name="medical" rows={2} className={inputCls} defaultValue={v.medical ?? defaults.medical ?? ''} />
          </Field>
        </div>
        <Input label="Emergency contact name" name="emergencyName" required defaultValue={v.emergencyName ?? defaults.emergencyName ?? ''} />
        <Input label="Emergency contact phone" name="emergencyPhone" type="tel" required defaultValue={v.emergencyPhone ?? defaults.emergencyPhone ?? ''} />
        <label className="flex items-start gap-3 text-sm sm:col-span-2">
          <input type="checkbox" name="photoConsent" defaultChecked={v.photoConsent ? v.photoConsent === 'on' : Boolean(defaults.photoConsent)} className="mt-1" />
          <span>Photos/video of this player may be used in club communications.</span>
        </label>
      </Fieldset>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="terms" required className="mt-1" />
        <span>I agree to the club’s <PolicyLink k="codeOfConduct">Code of Conduct</PolicyLink>, <PolicyLink k="childSafe">Child Safe policy</PolicyLink> and <PolicyLink k="refunds">registration and refund terms</PolicyLink>.</span>
      </label>
      {state.error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">{state.error}</p>}
      <Submit price={price} />
    </form>
  )
}

function Submit({ price }: { price: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="w-full rounded-full bg-accent px-6 py-4 font-semibold text-accent-ink hover:brightness-110 disabled:opacity-60">
      {pending ? 'Starting payment…' : `Pay ${price} & complete registration`}
    </button>
  )
}
