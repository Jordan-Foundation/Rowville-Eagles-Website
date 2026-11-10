'use client'

import { PayeeChip } from '@/components/PayeeChip'

import { PolicyLink } from '@/components/PolicyLink'
import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { bookProgram, type BookingState } from './actions'
import { Field, Fieldset, Input, inputCls } from '@/components/forms/Field'
import { PlayerFields } from '@/components/forms/PlayerFields'
import type { KidOption } from '@/lib/family-kids'
import { campQuote } from '@/lib/camps'

type Slot = { start: string; label: string; remaining: number }
export type CampOptions = {
  days: { date: string; label: string; hours: string; left: number | null; past: boolean }[]
  fullPrice: number
  dayPrice: number
  /** Every day is still to come and has a place */
  canFull: boolean
  saving: number
}
const aud = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)

export function BookingForm(props: {
  slug: string
  isTeamEntry: boolean
  slots: Slot[]
  priceLabel: string
  payeeLabel: string
  /** Team registrations: players on this account with an offer (name/DOB already known). */
  offeredPlayers?: { id: number; label: string }[]
  defaultPlayer?: string
  /** Logged-in families: their children (to pick) and their own details (prefilled). */
  kids?: KidOption[]
  prefill?: Record<string, string>
  bounds?: { min: number | null; max: number | null }
  /** Book brothers and sisters in the same checkout (camps, programs) */
  maxChildren?: number
  unitPrice?: number
  /** Holiday camps: full camp or chosen days */
  camp?: CampOptions | null
}) {
  const offer = (props.offeredPlayers?.length ?? 0) > 0
  const [state, action] = useActionState<BookingState, FormData>(bookProgram, {})
  const v = state.values ?? {}
  const c = { ...(props.prefill ?? {}), ...v }
  // Extra children (2, 3, 4) — restored after a failed submit
  const restored = Math.max(1, ...Object.keys(v).map((k) => Number(/^(?:playerFirstName|participant)_(\d)$/.exec(k)?.[1] ?? 1)))
  const [children, setChildren] = useState(restored)
  const maxKids = props.maxChildren ?? 1
  const kidIds = (props.kids ?? []).map((k) => String(k.id))
  const camp = props.camp ?? null
  const [campOption, setCampOption] = useState<'full' | 'days'>(v.campOption === 'days' || v.campOption === 'full' ? v.campOption : camp?.canFull ? 'full' : 'days')
  const [picked, setPicked] = useState<string[]>(() => (v.campDays ? v.campDays.split(',') : []))
  const quote = camp ? campQuote({ allDays: camp.days.map((d) => d.date), full: campOption === 'full', days: picked, prices: { full: camp.fullPrice, day: camp.dayPrice } }) : null
  const total = camp
    ? quote ? `${children > 1 ? `${children} children · ` : ''}${aud(quote.total * children)}` : 'choose days'
    : props.unitPrice != null && children > 1 ? `${children} children · ${aud(props.unitPrice * children)}` : props.priceLabel

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="program" value={props.slug} />

      {props.slots.length > 0 && (
        <fieldset className="panel rounded-2xl border border-line bg-surface-2 p-6 [[data-brand=academy]_&]:rounded-sm">
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

      {camp && (
        <fieldset className="panel rounded-2xl border border-line bg-surface-2 p-6 [[data-brand=academy]_&]:rounded-sm">
          <legend className="px-2 font-display text-lg font-semibold uppercase tracking-wide">Which days?</legend>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Full camp or choose days">
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm has-[:checked]:border-ink has-[:checked]:ring-1 has-[:checked]:ring-ink ${camp.canFull ? '' : 'pointer-events-none opacity-40'}`}>
              <input type="radio" name="campOption" value="full" disabled={!camp.canFull} checked={campOption === 'full'} onChange={() => setCampOption('full')} className="mt-1" />
              <span>
                <strong>Full camp</strong> · all {camp.days.length} days · {aud(camp.fullPrice)}
                <span className="block text-xs text-muted">{camp.canFull ? (camp.saving > 0 ? `Save ${aud(camp.saving)} on booking each day` : 'Every day of the camp') : 'Not available — some days have passed or are full'}</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm has-[:checked]:border-ink has-[:checked]:ring-1 has-[:checked]:ring-ink">
              <input type="radio" name="campOption" value="days" checked={campOption === 'days'} onChange={() => setCampOption('days')} className="mt-1" />
              <span>
                <strong>Choose days</strong> · {aud(camp.dayPrice)} a day
                <span className="block text-xs text-muted">Pick the days that suit you</span>
              </span>
            </label>
          </div>
          {campOption === 'days' && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {camp.days.map((d, i) => {
                const off = d.past || d.left === 0
                return (
                  <label key={d.date} className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm has-[:checked]:border-ink has-[:checked]:ring-1 has-[:checked]:ring-ink ${off ? 'pointer-events-none opacity-40' : ''}`}>
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        name="campDay"
                        value={d.date}
                        disabled={off}
                        checked={picked.includes(d.date)}
                        onChange={(e) => { const on = e.currentTarget.checked; setPicked((x) => (on ? [...x, d.date] : x.filter((y) => y !== d.date))) }}
                        aria-label={`${d.label} ${d.hours}`}
                        data-index={i}
                      />
                      <span><strong>{d.label}</strong> <span className="text-muted">· {d.hours}</span></span>
                    </span>
                    <span className="text-xs text-muted">{d.past ? 'Finished' : d.left === 0 ? 'Full' : d.left != null ? `${d.left} left` : ''}</span>
                  </label>
                )
              })}
            </div>
          )}
          {quote && (
            <p className="mt-4 text-sm" aria-live="polite">
              {quote.fullCamp ? `Full camp: ${aud(quote.total)} per child` : `${quote.days.length} day${quote.days.length === 1 ? '' : 's'} × ${aud(camp.dayPrice)} = ${aud(quote.total)} per child`}
            </p>
          )}
          {quote?.suggestFull && camp.canFull && (
            <div role="note" className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm">
              <span>Those days cost {aud(quote.dayTotal)} — the full camp is {aud(camp.fullPrice)} for all {camp.days.length} days. Save {aud(quote.saving)}.</span>
              <button type="button" onClick={() => setCampOption('full')} className="font-semibold underline">Switch to full camp</button>
            </div>
          )}
        </fieldset>
      )}

      <Fieldset legend={props.isTeamEntry ? 'Team manager' : 'Parent / guardian'}>
        <Input label="First name" name="contactFirstName" autoComplete="given-name" required defaultValue={c.contactFirstName} />
        <Input label="Last name" name="contactLastName" autoComplete="family-name" required defaultValue={c.contactLastName} />
        <Input label="Email" name="contactEmail" type="email" autoComplete="email" required defaultValue={c.contactEmail} />
        <Input label="Mobile" name="contactPhone" type="tel" autoComplete="tel" required defaultValue={c.contactPhone} />
      </Fieldset>

      {offer ? (
        <Fieldset legend="Player">
          <div className="space-y-2 sm:col-span-2">
            {props.offeredPlayers!.map((o, i) => (
              <label key={o.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm has-[:checked]:border-brand">
                <input type="radio" name="participant" value={o.id} required defaultChecked={(v.participant ?? props.defaultPlayer) ? (v.participant ?? props.defaultPlayer) === String(o.id) : i === 0} />
                {o.label}
              </label>
            ))}
          </div>
          <div className="sm:col-span-2">
            <Field label="Medical conditions, allergies or injuries" hint="Shared only with the player’s coaches.">
              <textarea name="medical" rows={2} className={inputCls} defaultValue={v.medical} />
            </Field>
          </div>
          <Input label="Emergency contact name" name="emergencyName" required defaultValue={v.emergencyName} />
          <Input label="Emergency contact phone" name="emergencyPhone" type="tel" required defaultValue={v.emergencyPhone} />
          <label className="flex items-start gap-3 text-sm sm:col-span-2">
            <input type="checkbox" name="photoConsent" defaultChecked={v.photoConsent === 'on'} className="mt-1" />
            <span>I consent to photos/video of this player being used in club communications.</span>
          </label>
        </Fieldset>
      ) : props.isTeamEntry ? (
        <Fieldset legend="Team">
          <Input label="Team name" name="teamName" required defaultValue={v.teamName} />
          <Input label="Club" name="playerLastName" placeholder="e.g. Rowville Eagles" defaultValue={v.playerLastName} />
        </Fieldset>
      ) : (
        <>
          <PlayerFields kids={props.kids ?? []} values={v} bounds={props.bounds} legend={children > 1 ? 'Child 1' : 'Player'} camp={!!camp} />
          {Array.from({ length: children - 1 }, (_, i) => i + 2).map((k) => (
            <PlayerFields
              key={k}
              suffix={`_${k}`}
              legend={`Child ${k}`}
              kids={props.kids ?? []}
              values={v}
              bounds={props.bounds}
              camp={!!camp}
              defaultWho={kidIds[k - 1] ?? 'new'}
              action={k === children ? <button type="button" onClick={() => setChildren(k - 1)} className="text-sm font-semibold text-muted underline hover:text-ink">Remove child {k}</button> : undefined}
            />
          ))}
          {children < maxKids && (
            <button type="button" onClick={() => setChildren((n) => n + 1)} className="w-full rounded-2xl border-2 border-dashed border-line px-4 py-3 text-sm font-semibold transition hover:border-ink [[data-brand=academy]_&]:rounded-none">
              + Add another child to this booking
            </button>
          )}
        </>
      )}

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="terms" required defaultChecked={v.terms === 'on'} className="mt-1" />
        <span>
          I agree to the club’s <PolicyLink k="codeOfConduct">Code of Conduct</PolicyLink>, <PolicyLink k="childSafe">Child Safe policy</PolicyLink> and <PolicyLink k="refunds">refund policy</PolicyLink>, and confirm the details above are correct.
        </span>
      </label>

      {state.error && (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 [[data-brand=academy]_&]:text-red-300">
          {state.error}
        </p>
      )}

      <PayeeChip label={props.payeeLabel} />
      <Submit priceLabel={total} disabled={!!camp && !quote} />
    </form>
  )
}

function Submit({ priceLabel, disabled }: { priceLabel: string; disabled?: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full rounded-full bg-accent px-6 py-4 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60 [[data-brand=academy]_&]:rounded-none [[data-brand=academy]_&]:uppercase [[data-brand=academy]_&]:tracking-[0.18em]"
    >
      {pending ? 'Starting secure checkout…' : `Continue to payment · ${priceLabel}`}
    </button>
  )
}
