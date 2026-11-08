'use client'

import { PolicyLink } from '@/components/PolicyLink'
import { useActionState, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { fullLabel, groupFor, groupLabel, type AgeRules } from '@/lib/age-groups'
import type { TrialNight } from '@/lib/rfa-trials'
import { Field, Fieldset, Input, inputCls } from '@/components/forms/Field'
import { bookRfaTrial, type RfaTrialState } from './actions'

export function RfaTrialForm({ rules, nights, priceLabel }: { rules: AgeRules; nights: TrialNight[]; priceLabel: string }) {
  const [state, action] = useActionState<RfaTrialState, FormData>(bookRfaTrial, {})
  const v = state.values ?? {}
  const [dob, setDob] = useState(v.playerDob ?? '')
  const group = useMemo(() => (dob ? groupFor(dob, rules) : null), [dob, rules])
  const ageGroup = group ? fullLabel(group) : null
  const forGroup = group ? nights.filter((n) => n.birthYears.includes(group.birthYear)) : []
  const offered = Array.from(new Set(nights.flatMap((n) => n.birthYears))).sort().map(groupLabel)

  return (
    <form action={action} className="space-y-6">
      <Fieldset legend="Player">
        <Input label="First name" name="playerFirstName" required defaultValue={v.playerFirstName} />
        <Input label="Last name" name="playerLastName" required defaultValue={v.playerLastName} />
        <Input label="Date of birth" name="playerDob" type="date" required value={dob} onChange={(e) => setDob(e.target.value)} />
        <div className="flex items-end">
          {ageGroup && (
            <p className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-sm" aria-live="polite">
              Age group: <strong>{ageGroup}</strong>
            </p>
          )}
        </div>
      </Fieldset>

      <fieldset className="panel rounded-sm border border-line bg-surface-2 p-6">
        <legend className="px-2 font-display text-lg font-semibold uppercase tracking-wide">Choose your trial night</legend>
        {!ageGroup ? (
          <p className="text-sm text-muted">Enter the player’s date of birth to see the nights their age group trains. This term runs for {offered.join(', ')}.</p>
        ) : forGroup.length === 0 ? (
          <p className="text-sm text-muted">This term doesn’t run a group for {ageGroup}. Contact us and we’ll let you know when one opens.</p>
        ) : (
          <div className="grid max-h-[26rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {forGroup.map((n) => {
              const left = n.remaining[String(group!.birthYear)] ?? 0
              return (
                <label
                  key={n.start}
                  className={`flex cursor-pointer items-center justify-between gap-3 border border-line bg-surface px-4 py-3 text-sm transition has-[:checked]:border-white has-[:checked]:ring-1 has-[:checked]:ring-white ${left === 0 ? 'pointer-events-none opacity-35' : 'hover:border-white/40'}`}
                >
                  <span className="flex items-center gap-3">
                    <input type="radio" name="night" value={n.start} required disabled={left === 0} defaultChecked={v.night === n.start} className="accent-white" />
                    {n.label}
                  </span>
                  <span className="text-xs uppercase tracking-wider text-muted">{left === 0 ? 'Full' : `${left} spot${left === 1 ? '' : 's'}`}</span>
                </label>
              )
            })}
          </div>
        )}
      </fieldset>

      <Fieldset legend="Parent / guardian">
        <Input label="First name" name="contactFirstName" autoComplete="given-name" required defaultValue={v.contactFirstName} />
        <Input label="Last name" name="contactLastName" autoComplete="family-name" required defaultValue={v.contactLastName} />
        <Input label="Email" name="contactEmail" type="email" autoComplete="email" required defaultValue={v.contactEmail} />
        <Input label="Mobile" name="contactPhone" type="tel" autoComplete="tel" required defaultValue={v.contactPhone} />
        <div className="sm:col-span-2">
          <Field label="Medical conditions, allergies or injuries">
            <textarea name="medical" rows={2} className={inputCls} defaultValue={v.medical} />
          </Field>
        </div>
        <Input label="Emergency contact name" name="emergencyName" required defaultValue={v.emergencyName} />
        <Input label="Emergency contact phone" name="emergencyPhone" type="tel" required defaultValue={v.emergencyPhone} />
        <label className="flex items-start gap-3 text-sm sm:col-span-2">
          <input type="checkbox" name="photoConsent" defaultChecked={v.photoConsent === 'on'} className="mt-1" />
          <span>I consent to photos/video of this player being used in Academy communications.</span>
        </label>
      </Fieldset>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="terms" required defaultChecked={v.terms === 'on'} className="mt-1" />
        <span>I agree to the Academy’s <PolicyLink k="codeOfConduct">Code of Conduct</PolicyLink>, <PolicyLink k="childSafe">Child Safe policy</PolicyLink> and <PolicyLink k="academyTerms">terms</PolicyLink>.</span>
      </label>
      {state.error && <p role="alert" className="border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{state.error}</p>}
      <Submit priceLabel={priceLabel} />
    </form>
  )
}

function Submit({ priceLabel }: { priceLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="w-full bg-white px-6 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-black transition hover:bg-white/85 disabled:opacity-60">
      {pending ? 'Booking…' : `Book trial · ${priceLabel}`}
    </button>
  )
}
