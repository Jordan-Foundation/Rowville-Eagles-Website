'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Field, Fieldset, Input, inputCls } from '@/components/forms/Field'
import { CONSENT_WORDING } from '@/lib/consent-wording'
import { bookCasual, type BookState } from './actions'

type Props = {
  coach: number
  start: string
  term: number
  price: string
  me: { firstName?: string | null; lastName?: string | null; email: string; phone?: string | null } | null
  players: { id: number; name: string }[]
}

export function BookForm({ coach, start, term, price, me, players }: Props) {
  const [state, action] = useActionState<BookState, FormData>(bookCasual, {})
  const v = state.values ?? {}
  const [who, setWho] = useState(v.participant ?? (players[0] ? String(players[0].id) : 'new'))
  const newPlayer = !me || who === 'new'

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="coach" value={coach} />
      <input type="hidden" name="start" value={start} />
      <input type="hidden" name="term" value={term} />

      {me ? (
        <div className="panel border border-line p-5 text-sm">
          <p className="text-muted">Booking as</p>
          <p className="mt-1 font-semibold">{[me.firstName, me.lastName].filter(Boolean).join(' ') || me.email} · {me.email}</p>
          {!me.phone && <div className="mt-4 max-w-xs"><Input label="Mobile (for session reminders)" name="contactMobile" type="tel" required defaultValue={v.contactMobile} /></div>}
          {(!me.firstName || !me.lastName) && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Input label="First name" name="contactFirstName" required defaultValue={v.contactFirstName ?? me.firstName ?? ''} />
              <Input label="Last name" name="contactLastName" required defaultValue={v.contactLastName ?? me.lastName ?? ''} />
            </div>
          )}
        </div>
      ) : (
        <Fieldset legend="Parent / guardian">
          <Input label="First name" name="contactFirstName" autoComplete="given-name" required defaultValue={v.contactFirstName} />
          <Input label="Last name" name="contactLastName" autoComplete="family-name" required defaultValue={v.contactLastName} />
          <Input label="Email" name="contactEmail" type="email" autoComplete="email" required defaultValue={v.contactEmail} />
          <Input label="Mobile" name="contactMobile" type="tel" autoComplete="tel" required placeholder="0412 345 678" defaultValue={v.contactMobile} />
        </Fieldset>
      )}

      <Fieldset legend="Player">
        {me && players.length > 0 && (
          <div className="sm:col-span-2">
            <Field label="Who is this session for?">
              <select name="participant" value={who} onChange={(e) => setWho(e.target.value)} className={inputCls}>
                {players.map((pl) => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                <option value="new">Someone else…</option>
              </select>
            </Field>
          </div>
        )}
        {newPlayer && (
          <>
            <Input label="First name" name="playerFirstName" required defaultValue={v.playerFirstName} />
            <Input label="Last name" name="playerLastName" required defaultValue={v.playerLastName} />
            <Input label="Date of birth" name="playerDob" type="date" required defaultValue={v.playerDob} />
          </>
        )}
        <Input label="Current club" name="currentClub" defaultValue={v.currentClub} />
        <Input label="Position" name="position" placeholder="e.g. Winger, Goalkeeper" defaultValue={v.position} />
        <div className="sm:col-span-2">
          <Field label="Main goals for the session">
            <textarea name="goals" rows={2} className={inputCls} defaultValue={v.goals} placeholder="e.g. Improve weak foot, confidence in 1v1s" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Medical or injury notes" hint="Shared only with the coach.">
            <textarea name="medical" rows={2} className={inputCls} defaultValue={v.medical} />
          </Field>
        </div>
        <Input label="Emergency contact name" name="emergencyName" required defaultValue={v.emergencyName} />
        <Input label="Emergency contact phone" name="emergencyPhone" type="tel" required defaultValue={v.emergencyPhone} />
        <label className="flex items-start gap-3 text-sm sm:col-span-2">
          <input type="checkbox" name="photoConsent" defaultChecked={v.photoConsent === 'on'} className="mt-1" />
          <span>I consent to photos/video of this player being used in Foundation Academy communications.</span>
        </label>
      </Fieldset>

      <div className="space-y-3 text-sm">
        <label className="flex items-start gap-3">
          <input type="checkbox" name="terms" required defaultChecked={v.terms === 'on'} className="mt-1" />
          <span>I agree to the Foundation Academy terms, Code of Conduct and Child Safe policy. Casual sessions cancelled 24 hours or more before the start can be credited or refunded.</span>
        </label>
        {!me && (
          <label className="flex items-start gap-3">
            <input type="checkbox" name="marketingOptIn" defaultChecked={v.marketingOptIn === 'on'} className="mt-1" />
            <span>{CONSENT_WORDING.checkoutOptIn}</span>
          </label>
        )}
      </div>

      {state.error && <p role="alert" className="border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{state.error}</p>}
      <Submit price={price} />
      <p className="text-center text-xs text-muted">Your time is held for 30 minutes while you pay · Secure payment by Stripe to Foundation Sports Australia Pty Ltd</p>
    </form>
  )
}

function Submit({ price }: { price: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="w-full bg-white px-6 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-black hover:bg-white/85 disabled:opacity-60">
      {pending ? 'Holding your time…' : `Continue to payment · ${price}`}
    </button>
  )
}
