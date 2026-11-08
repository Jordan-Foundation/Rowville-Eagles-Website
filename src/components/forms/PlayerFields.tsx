'use client'

import { useState } from 'react'
import { Field, Fieldset, Input, inputCls } from './Field'
import { checkAge } from '@/lib/age-check'
import type { KidOption } from '@/lib/family-kids'

type Bounds = { min: number | null; max: number | null }

/** Live "Ava is 8 — right age ✓" line under the date of birth. */
export function AgeHint({ dob, name, bounds }: { dob: string; name: string; bounds?: Bounds }) {
  const r = bounds ? checkAge(dob, bounds, name) : null
  if (!r) return null
  return <p role="status" className={`text-sm sm:col-span-2 ${r.ok ? 'text-emerald-700 [[data-brand=academy]_&]:text-emerald-300' : 'font-semibold text-amber-700 [[data-brand=academy]_&]:text-amber-300'}`}>{r.message}</p>
}

/**
 * The player part of a booking form. Logged-in families pick one of their children ("Book for: Ava / + New child"),
 * which fills in the name and date of birth and reuses the saved medical notes and emergency contact (still editable).
 * Field names match the existing forms: participant, playerFirstName, playerLastName, playerDob, medical,
 * emergencyName, emergencyPhone, photoConsent.
 */
export function PlayerFields(props: {
  kids: KidOption[]
  values: Record<string, string>
  bounds?: Bounds
  medicalHint?: string
  photoText?: string
  legend?: string
  /** Hide the medical/emergency/photo part (e.g. forms that ask elsewhere). */
  detailsOnly?: boolean
}) {
  const v = props.values
  const first = v.participant ?? (props.kids[0] ? String(props.kids[0].id) : 'new')
  const [who, setWho] = useState(props.kids.length ? first : 'new')
  const kid = props.kids.find((k) => String(k.id) === who) ?? null
  const [dob, setDob] = useState(v.playerDob ?? '')
  const [name, setName] = useState(v.playerFirstName ?? '')
  return (
    <Fieldset legend={props.legend ?? 'Player'}>
      {props.kids.length > 0 && (
        <div className="space-y-2 sm:col-span-2" role="radiogroup" aria-label="Who is this booking for?">
          <p className="text-sm font-semibold">Who is it for?</p>
          <div className="flex flex-wrap gap-2">
            {props.kids.map((k) => (
              <label key={k.id} className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-sm has-[:checked]:border-ink has-[:checked]:ring-1 has-[:checked]:ring-ink">
                <input type="radio" name="$who" value={k.id} checked={who === String(k.id)} onChange={() => setWho(String(k.id))} />
                {k.firstName}
              </label>
            ))}
            <label className="flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-line px-4 py-2.5 text-sm has-[:checked]:border-ink">
              <input type="radio" name="$who" value="new" checked={who === 'new'} onChange={() => setWho('new')} />
              + New child
            </label>
          </div>
        </div>
      )}
      {kid ? (
        <>
          <input type="hidden" name="participant" value={kid.id} />
          <input type="hidden" name="playerFirstName" value={kid.firstName} />
          <input type="hidden" name="playerLastName" value={kid.lastName} />
          <input type="hidden" name="playerDob" value={kid.dob} />
          <p className="text-sm sm:col-span-2">
            <strong>{kid.firstName} {kid.lastName}</strong> · born {kid.dob ? new Date(`${kid.dob}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
          </p>
          <AgeHint dob={kid.dob} name={kid.firstName} bounds={props.bounds} />
        </>
      ) : (
        <>
          <Input label="First name" name="playerFirstName" required defaultValue={v.playerFirstName} onChange={(e) => setName(e.currentTarget.value)} />
          <Input label="Last name" name="playerLastName" required defaultValue={v.playerLastName} />
          <Input label="Date of birth" name="playerDob" type="date" required defaultValue={v.playerDob} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDob(e.currentTarget.value)} />
          <div className="hidden sm:block" />
          <AgeHint dob={dob} name={name} bounds={props.bounds} />
        </>
      )}
      {!props.detailsOnly && (
        // key: switching child refills the saved details
        <div key={who} className="contents">
          <div className="sm:col-span-2">
            <Field label="Medical conditions, allergies or injuries" hint={props.medicalHint ?? 'Shared only with the coaches running this program.'}>
              <textarea name="medical" rows={2} className={inputCls} defaultValue={v.medical ?? kid?.medical ?? ''} />
            </Field>
          </div>
          <Input label="Emergency contact name" name="emergencyName" required defaultValue={v.emergencyName ?? kid?.emergencyName ?? ''} />
          <Input label="Emergency contact phone" name="emergencyPhone" type="tel" required defaultValue={v.emergencyPhone ?? kid?.emergencyPhone ?? ''} />
          <label className="flex items-start gap-3 text-sm sm:col-span-2">
            <input type="checkbox" name="photoConsent" defaultChecked={v.photoConsent ? v.photoConsent === 'on' : !!kid?.photoConsent} className="mt-1" />
            <span>{props.photoText ?? 'I consent to photos/video of this player being used in club and Academy communications.'}</span>
          </label>
          {kid && (kid.medical || kid.emergencyName) && <p className="text-xs text-muted sm:col-span-2">Filled in from {kid.firstName}’s profile — any changes are saved for next time.</p>}
        </div>
      )}
    </Fieldset>
  )
}
