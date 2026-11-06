'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Field, Fieldset, Input, inputCls } from '@/components/forms/Field'
import { CONSENT_WORDING } from '@/lib/consent-wording'
import { bookSession, type BookState } from './actions'

type Props = {
  coach: number
  term: number
  /** casual: the session start; term: weekday + time + how many sessions the family was shown */
  slot: { mode: 'casual'; start: string } | { mode: 'term'; weekday: string; time: string; sessions: number }
  price: string
  /** Term only: the weekly plan on offer (null when there aren't enough sessions left) */
  weekly?: { perSession: string; total: string; laterPayments: number; firstCharge: string; lastCharge: string } | null
  me: { firstName?: string | null; lastName?: string | null; email: string; phone?: string | null } | null
  players: { id: number; name: string }[]
}

export function BookForm({ coach, slot, term, price, weekly, me, players }: Props) {
  const [state, action] = useActionState<BookState, FormData>(bookSession, {})
  const v = state.values ?? {}
  const [who, setWho] = useState(v.participant ?? (players[0] ? String(players[0].id) : 'new'))
  const newPlayer = !me || who === 'new'
  const [payMode, setPayMode] = useState<'upfront' | 'weekly'>(v.payMode === 'weekly' && weekly ? 'weekly' : 'upfront')

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="coach" value={coach} />
      <input type="hidden" name="term" value={term} />
      <input type="hidden" name="mode" value={slot.mode} />
      {slot.mode === 'casual' ? (
        <input type="hidden" name="start" value={slot.start} />
      ) : (
        <>
          <input type="hidden" name="weekday" value={slot.weekday} />
          <input type="hidden" name="time" value={slot.time} />
          <input type="hidden" name="expectedSessions" value={slot.sessions} />
        </>
      )}

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
          <Field label={slot.mode === 'term' ? 'Main goals for the term' : 'Main goals for the session'}>
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

      {slot.mode === 'term' && (
        <Fieldset legend="Payment">
          <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
            <PayOption name="payMode" value="upfront" checked={payMode === 'upfront'} onChange={() => setPayMode('upfront')} title={`Pay upfront · ${price}`} detail={`All ${slot.sessions} sessions paid today.`} />
            {weekly && (
              <PayOption
                name="payMode"
                value="weekly"
                checked={payMode === 'weekly'}
                onChange={() => setPayMode('weekly')}
                title={`Pay weekly · ${weekly.perSession}/week`}
                detail={`${weekly.perSession} today, then ${weekly.laterPayments} automatic payments of ${weekly.perSession}, each taken 2 days before the session (${weekly.firstCharge} – ${weekly.lastCharge}). Same total: ${weekly.total}.`}
              />
            )}
          </div>
        </Fieldset>
      )}

      <div className="space-y-3 text-sm">
        <label className="flex items-start gap-3">
          <input type="checkbox" name="terms" required defaultChecked={v.terms === 'on'} className="mt-1" />
          <span>
            I agree to the Foundation Academy terms, Code of Conduct and Child Safe policy.{' '}
            {slot.mode === 'casual'
              ? 'Casual sessions cancelled 24 hours or more before the start can be credited or refunded.'
              : 'Term bookings can be cancelled any time; unplayed future sessions are credited or refunded, less one session.'}
            {slot.mode === 'term' && payMode === 'weekly' && ' I authorise Foundation Sports Australia Pty Ltd to charge my card weekly as shown until the last session is paid; weekly payments stop if the booking is cancelled.'}
          </span>
        </label>
        {!me && (
          <label className="flex items-start gap-3">
            <input type="checkbox" name="marketingOptIn" defaultChecked={v.marketingOptIn === 'on'} className="mt-1" />
            <span>{CONSENT_WORDING.checkoutOptIn}</span>
          </label>
        )}
      </div>

      {state.error && <p role="alert" className="border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{state.error}</p>}
      <Submit price={slot.mode === 'term' && payMode === 'weekly' && weekly ? `${weekly.perSession} today` : price} />
      <p className="text-center text-xs text-muted">Your time is held for 30 minutes while you pay · Secure payment by Stripe to Foundation Sports Australia Pty Ltd</p>
    </form>
  )
}

function PayOption({ title, detail, ...input }: { name: string; value: string; checked: boolean; onChange: () => void; title: string; detail: string }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 border p-4 text-sm ${input.checked ? 'border-white bg-white/5' : 'border-line hover:border-white/40'}`}>
      <input type="radio" {...input} className="mt-1" />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block text-muted">{detail}</span>
      </span>
    </label>
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
