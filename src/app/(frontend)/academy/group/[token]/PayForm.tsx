'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { PolicyLink } from '@/components/PolicyLink'
import { Fieldset, Input } from '@/components/forms/Field'
import { declineGroupPlace, payGroupPlace, termOfferAction, type GroupPayState } from './actions'

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`

export type PayInfo = {
  token: string
  type: 'casual' | 'term'
  rate: number
  sessions: number
  weeklyOk: boolean
  player: string
  needsDob: boolean
  mobile: string
  emergencyName: string
  emergencyPhone: string
  /** Rest of the term after a one-off: what they overpaid for week 1, taken off */
  credit?: number
  /** Small group credits on the family's account (used automatically, not with weekly payments) */
  groupCredits?: number
}

function PayButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return <button disabled={pending} className="w-full bg-white px-6 py-4 text-sm font-semibold uppercase tracking-[0.15em] text-black disabled:opacity-50 sm:w-auto">{pending ? 'Taking you to payment…' : label}</button>
}

export function PayForm({ info }: { info: PayInfo }) {
  const [state, action] = useActionState<GroupPayState, FormData>(payGroupPlace, {})
  const [payMode, setPayMode] = useState<'upfront' | 'weekly'>('upfront')
  const v = state.values ?? {}
  const credit = info.credit ?? 0
  const total = Math.round((info.rate * info.sessions - credit) * 100) / 100
  const weekly = Math.round((total / info.sessions) * 100) / 100
  const weeklyChosen = info.type === 'term' && payMode === 'weekly'
  const creditsUsed = weeklyChosen ? 0 : Math.min(info.groupCredits ?? 0, info.sessions)
  const creditOff = Math.round(creditsUsed * (total / info.sessions) * 100) / 100
  const today = weeklyChosen ? weekly : Math.max(0, Math.round((total - creditOff) * 100) / 100)
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="token" value={info.token} />
      {info.type === 'term' && (
        <fieldset>
          <legend className="text-sm font-semibold">How would you like to pay?</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className={`cursor-pointer border p-4 text-sm ${payMode === 'upfront' ? 'border-white' : 'border-line'}`}>
              <input type="radio" name="payMode" value="upfront" checked={payMode === 'upfront'} onChange={() => setPayMode('upfront')} className="mr-2" />
              <span className="font-semibold">Pay for the term now</span>
              <span className="mt-1 block text-muted">{money(total)} — {info.sessions} sessions × {money(info.rate)}{credit ? `, less ${money(credit)} already paid for week 1` : ''}</span>
            </label>
            {info.weeklyOk && (
              <label className={`cursor-pointer border p-4 text-sm ${payMode === 'weekly' ? 'border-white' : 'border-line'}`}>
                <input type="radio" name="payMode" value="weekly" checked={payMode === 'weekly'} onChange={() => setPayMode('weekly')} className="mr-2" />
                <span className="font-semibold">Pay weekly</span>
                <span className="mt-1 block text-muted">{money(weekly)} today, then {money(weekly)} 2 days before each session</span>
              </label>
            )}
          </div>
        </fieldset>
      )}
      <Fieldset legend={`About ${info.player}`}>
        {info.needsDob && <Input label={`${info.player}’s date of birth`} name="playerDob" type="date" required defaultValue={v.playerDob} />}
        <Input label="Your mobile" name="contactMobile" type="tel" required defaultValue={v.contactMobile ?? info.mobile} />
        <Input label="Emergency contact name" name="emergencyName" required defaultValue={v.emergencyName ?? info.emergencyName} />
        <Input label="Emergency contact phone" name="emergencyPhone" type="tel" required defaultValue={v.emergencyPhone ?? info.emergencyPhone} />
        <Input label="Medical or injury notes (optional)" name="medical" defaultValue={v.medical} />
        <Input label="What would they like to work on? (optional)" name="goals" defaultValue={v.goals} />
        <label className="flex items-start gap-3 text-sm sm:col-span-2">
          <input type="checkbox" name="photoConsent" defaultChecked={v.photoConsent === 'on'} className="mt-1" />
          <span>I consent to photos/video of this player being used in Foundation Academy communications.</span>
        </label>
      </Fieldset>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="terms" required defaultChecked={v.terms === 'on'} className="mt-1" />
        <span>
          I agree to the <PolicyLink k="academyTerms">Foundation Academy terms</PolicyLink>, <PolicyLink k="codeOfConduct">Code of Conduct</PolicyLink> and <PolicyLink k="childSafe">Child Safe policy</PolicyLink>.{' '}
          {info.type === 'casual' ? 'Sessions cancelled 24 hours or more before the start can be credited or refunded.' : 'Term bookings can be cancelled any time; unplayed future sessions are credited or refunded, less one session.'}
          {info.type === 'term' && payMode === 'weekly' && ' I authorise Foundation Sports Australia Pty Ltd to charge my card weekly as shown until the last session is paid; weekly payments stop if the booking is cancelled.'}
        </span>
      </label>
      {creditsUsed > 0 && <p className="text-sm text-emerald-200">{creditsUsed} small group credit{creditsUsed === 1 ? '' : 's'} on your account will be used ({money(creditOff)} off).</p>}
      {state.error && <p role="alert" className="border border-red-400/40 p-3 text-sm text-red-300">{state.error}</p>}
      <PayButton label={today <= 0 ? 'Book with my credit' : `Pay ${money(today)}${weeklyChosen ? ' today' : ''}`} />
    </form>
  )
}

export function DeclineForm({ token, player }: { token: string; player: string }) {
  const [state, action, pending] = useActionState<GroupPayState, FormData>(declineGroupPlace, {})
  return (
    <form action={action} onSubmit={(e) => { if (!window.confirm(`Let your coach know ${player} can’t make it?`)) e.preventDefault() }} className="mt-4">
      <input type="hidden" name="token" value={token} />
      <button disabled={pending} className="text-sm text-muted underline hover:text-ink">{player} can’t make it</button>
      {state.error && <p role="alert" className="mt-2 text-sm text-red-300">{state.error}</p>}
    </form>
  )
}

/** Book the whole term together: "I'm interested", or yes/no to another family's offer. */
export function TermOfferForm({ token, mode, label }: { token: string; mode: 'interested' | 'answer'; label?: string }) {
  const [state, action, pending] = useActionState<GroupPayState, FormData>(termOfferAction, {})
  return (
    <form action={action} className="mt-4 flex flex-wrap gap-3">
      <input type="hidden" name="token" value={token} />
      {mode === 'interested' ? (
        <button name="do" value="interested" disabled={pending} className="bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-black disabled:opacity-50">{pending ? 'Asking…' : label ?? 'I’m interested'}</button>
      ) : (
        <>
          <button name="do" value="yes" disabled={pending} className="bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-black disabled:opacity-50">Yes, book the term</button>
          <button name="do" value="no" disabled={pending} className="border border-line px-5 py-3 text-sm font-semibold uppercase tracking-[0.15em] disabled:opacity-50">No thanks</button>
        </>
      )}
      {state.error && <p role="alert" className="w-full text-sm text-red-300">{state.error}</p>}
    </form>
  )
}
