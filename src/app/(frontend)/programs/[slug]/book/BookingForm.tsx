'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { bookProgram, type BookingState } from './actions'
import { Field, Fieldset, Input, inputCls } from '@/components/forms/Field'

type Slot = { start: string; label: string; remaining: number }

export function BookingForm(props: {
  slug: string
  isTeamEntry: boolean
  slots: Slot[]
  priceLabel: string
  payeeLabel: string
}) {
  const [state, action] = useActionState<BookingState, FormData>(bookProgram, {})
  const v = state.values ?? {}

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="program" value={props.slug} />

      {props.slots.length > 0 && (
        <fieldset className="rounded-2xl border border-line bg-surface-2 p-6">
          <legend className="px-2 font-display text-lg font-semibold uppercase tracking-wide">Choose a time</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {props.slots.map((s) => (
              <label
                key={s.start}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm transition has-[:checked]:border-ink has-[:checked]:ring-1 has-[:checked]:ring-ink ${s.remaining === 0 ? 'pointer-events-none opacity-40' : ''}`}
              >
                <span className="flex items-center gap-3">
                  <input type="radio" name="slot" value={s.start} required disabled={s.remaining === 0} defaultChecked={v.slot === s.start} className="accent-current" />
                  {s.label}
                </span>
                <span className="text-xs text-muted">{s.remaining === 0 ? 'Booked' : `${s.remaining} left`}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <Fieldset legend={props.isTeamEntry ? 'Team manager' : 'Parent / guardian'}>
        <Input label="First name" name="contactFirstName" autoComplete="given-name" required defaultValue={v.contactFirstName} />
        <Input label="Last name" name="contactLastName" autoComplete="family-name" required defaultValue={v.contactLastName} />
        <Input label="Email" name="contactEmail" type="email" autoComplete="email" required defaultValue={v.contactEmail} />
        <Input label="Mobile" name="contactPhone" type="tel" autoComplete="tel" required defaultValue={v.contactPhone} />
      </Fieldset>

      {props.isTeamEntry ? (
        <Fieldset legend="Team">
          <Input label="Team name" name="teamName" required defaultValue={v.teamName} />
          <Input label="Club" name="playerLastName" placeholder="e.g. Rowville Eagles" defaultValue={v.playerLastName} />
        </Fieldset>
      ) : (
        <Fieldset legend="Player">
          <Input label="First name" name="playerFirstName" required defaultValue={v.playerFirstName} />
          <Input label="Last name" name="playerLastName" required defaultValue={v.playerLastName} />
          <Input label="Date of birth" name="playerDob" type="date" required defaultValue={v.playerDob} />
          <div className="sm:col-span-2">
            <Field label="Medical conditions, allergies or injuries" hint="Shared only with the coaches running this program.">
              <textarea name="medical" rows={2} className={inputCls} defaultValue={v.medical} />
            </Field>
          </div>
          <Input label="Emergency contact name" name="emergencyName" required defaultValue={v.emergencyName} />
          <Input label="Emergency contact phone" name="emergencyPhone" type="tel" required defaultValue={v.emergencyPhone} />
          <label className="flex items-start gap-3 text-sm sm:col-span-2">
            <input type="checkbox" name="photoConsent" defaultChecked={v.photoConsent === 'on'} className="mt-1" />
            <span>I consent to photos/video of this player being used in club and Academy communications.</span>
          </label>
        </Fieldset>
      )}

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="terms" required defaultChecked={v.terms === 'on'} className="mt-1" />
        <span>
          I agree to the club’s Code of Conduct, Child Safe policy and refund policy, and confirm the details above are correct.
        </span>
      </label>

      {state.error && (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 [[data-brand=academy]_&]:text-red-300">
          {state.error}
        </p>
      )}

      <Submit priceLabel={props.priceLabel} />
      <p className="text-center text-xs text-muted">
        Secure payment by Stripe · Paid to {props.payeeLabel}
      </p>
    </form>
  )
}

function Submit({ priceLabel }: { priceLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-accent px-6 py-4 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60 [[data-brand=academy]_&]:rounded-none [[data-brand=academy]_&]:uppercase [[data-brand=academy]_&]:tracking-[0.18em]"
    >
      {pending ? 'Starting secure checkout…' : `Continue to payment · ${priceLabel}`}
    </button>
  )
}
