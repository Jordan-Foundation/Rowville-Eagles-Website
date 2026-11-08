'use client'

import { AgeHint } from '@/components/forms/PlayerFields'
import type { KidOption } from '@/lib/family-kids'
import { PolicyLink } from '@/components/PolicyLink'
import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { bookTerm, type TermState } from './term-actions'
import { Field, Fieldset, Input, inputCls } from '@/components/forms/Field'

export type TermSlotOption = { id: number; label: string; years: string; birthYears: number[]; remaining: number | null; sessions: string; bookable: boolean; total: number; priceLabel: string; twoTotal: number; twoLabel: string }

export function TermBookingForm(props: { slug: string; slots: TermSlotOption[]; rates: { one: number | null; two: number | null }; payeeLabel: string; prefill?: Record<string, string>; kids?: KidOption[]; bounds?: { min: number | null; max: number | null } }) {
  const [state, action] = useActionState<TermState, FormData>(bookTerm, {})
  const v = { ...props.prefill, ...state.values }
  const kids = props.kids ?? []
  const [who, setWho] = useState(v.participant ?? (kids[0] ? String(kids[0].id) : 'new'))
  const kid = kids.find((k) => String(k.id) === who) ?? null
  const [typedDob, setDob] = useState(v.playerDob ?? '')
  const dob = kid ? kid.dob : typedDob
  const [typedName, setTypedName] = useState(v.playerFirstName ?? '')
  const [picked, setPicked] = useState(v.slot ?? '')
  const year = /^\d{4}-\d{2}-\d{2}$/.test(dob) ? Number(dob.slice(0, 4)) : null
  const fits = year ? props.slots.filter((s) => s.birthYears.includes(year) && s.bookable) : []
  // (2-night totals add both nights' sessions at the 2-night rate)
  const open = fits.filter((s) => s.remaining !== 0)
  const [nights, setNights] = useState<'1' | '2'>(v.nights === '2' ? '2' : '1')
  const [pair, setPair] = useState<number[]>([])
  const canTwo = props.rates.two != null && open.length >= 2
  const two = canTwo && nights === '2'
  const twoPicked = open.length === 2 ? open : open.filter((s) => pair.includes(s.id))
  const chosen = open.length === 1 ? open[0] : open.find((s) => String(s.id) === picked)
  const total = two ? (twoPicked.length === 2 ? twoPicked.reduce((n, s) => n + s.twoTotal, 0) : null) : (chosen?.total ?? null)
  const togglePair = (id: number) => setPair((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-2)))
  const aud = (n: number) => n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: n % 1 ? 2 : 0 })
  const interest = year !== null && open.length === 0

  if (state.interest) {
    return (
      <div role="status" className="panel rounded-2xl border border-line bg-surface-2 p-7 [[data-brand=academy]_&]:rounded-sm">
        <h2 className="font-display text-2xl font-bold uppercase">Interest registered</h2>
        <p className="mt-3 text-muted">
          {state.interest.reason === 'full' ? 'The training times for this age group are full right now' : 'There isn’t a training time for this age group yet'}, so nothing has been charged.
          We’ll email <strong>{state.interest.email}</strong> as soon as a place is available, with a link to confirm and pay.
        </p>
        <p className="mt-3 text-sm text-muted">Reference {state.interest.reference}</p>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="program" value={props.slug} />
      <Fieldset legend="Player">
        {kids.length > 0 && (
          <div className="space-y-2 sm:col-span-2" role="radiogroup" aria-label="Who is this booking for?">
            <p className="text-sm font-semibold">Who is it for?</p>
            <div className="flex flex-wrap gap-2">
              {kids.map((k) => (
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
            <p className="text-sm sm:col-span-2"><strong>{kid.firstName} {kid.lastName}</strong> · born {kid.dob ? new Date(`${kid.dob}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</p>
            <AgeHint dob={kid.dob} name={kid.firstName} bounds={props.bounds} />
          </>
        ) : (
          <>
            <Input label="First name" name="playerFirstName" required defaultValue={v.playerFirstName} onChange={(e) => setTypedName(e.currentTarget.value)} />
            <Input label="Last name" name="playerLastName" required defaultValue={v.playerLastName} />
            <Field label="Date of birth" hint="Players train with their year of birth.">
              <input name="playerDob" type="date" required value={typedDob} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDob(e.target.value)} className={inputCls} />
            </Field>
            <AgeHint dob={typedDob} name={typedName} bounds={props.bounds} />
          </>
        )}
      </Fieldset>

      {year !== null && (
        <fieldset className="panel rounded-2xl border border-line bg-surface-2 p-6 [[data-brand=academy]_&]:rounded-sm">
          <legend className="px-2 font-display text-lg font-semibold uppercase tracking-wide">Training time · {year}s</legend>
          {interest ? (
            <p className="text-sm">
              {fits.length ? `The ${year}s training times are full right now.` : `There isn’t a training time for ${year}s this term yet.`} You can still register
              interest below — <strong>nothing is charged</strong>, and we’ll email you when a place is available.
            </p>
          ) : (
            <div className="grid gap-3">
              {canTwo && (
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Nights a week">
                  {(['1', '2'] as const).map((n) => (
                    <label key={n} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm has-[:checked]:border-ink has-[:checked]:ring-1 has-[:checked]:ring-ink">
                      <input type="radio" name="nights" value={n} checked={nights === n} onChange={() => setNights(n)} className="accent-current" />
                      <span>
                        <span className="block font-semibold">{n === '1' ? '1 night a week' : '2 nights a week'}</span>
                        <span className="block text-xs text-muted">{aud((n === '1' ? props.rates.one : props.rates.two) ?? 0)} per session</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {!two && <input type="hidden" name="nights" value="1" />}
              {two ? (
                <>
                  <p className="text-sm text-muted">{open.length === 2 ? 'Your two training times:' : 'Choose two training times:'}</p>
                  {open.map((s) => (
                    <label key={s.id} className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm has-[:checked]:border-ink has-[:checked]:ring-1 has-[:checked]:ring-ink">
                      <span className="flex items-start gap-3">
                        <input type="checkbox" name="slots" value={s.id} checked={open.length === 2 || pair.includes(s.id)} disabled={open.length === 2} onChange={() => togglePair(s.id)} className="mt-1 accent-current" />
                        {open.length === 2 && <input type="hidden" name="slots" value={s.id} />}
                        <span>
                          <span className="block font-semibold">{s.label}</span>
                          <span className="block text-xs text-muted">{s.years} · {s.sessions}</span>
                          <span className="block text-xs font-semibold">{s.twoLabel}</span>
                        </span>
                      </span>
                      {s.remaining !== null && <span className="shrink-0 text-xs text-muted">{s.remaining} left</span>}
                    </label>
                  ))}
                </>
              ) : (
                <>
                  {open.length > 1 && <p className="text-sm text-muted">Choose the night that suits you best:</p>}
                  {open.map((s) => (
                    <label key={s.id} className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm has-[:checked]:border-ink has-[:checked]:ring-1 has-[:checked]:ring-ink">
                      <span className="flex items-start gap-3">
                        <input type="radio" name="slot" value={s.id} required checked={open.length === 1 || picked === String(s.id)} onChange={() => setPicked(String(s.id))} className="mt-1 accent-current" />
                        <span>
                          <span className="block font-semibold">{s.label}</span>
                          <span className="block text-xs text-muted">{s.years} · {s.sessions}</span>
                          <span className="block text-xs font-semibold">{s.priceLabel}</span>
                        </span>
                      </span>
                      {s.remaining !== null && <span className="shrink-0 text-xs text-muted">{s.remaining} left</span>}
                    </label>
                  ))}
                </>
              )}
            </div>
          )}
        </fieldset>
      )}

      <Fieldset legend="Parent / guardian">
        <Input label="First name" name="contactFirstName" autoComplete="given-name" required defaultValue={v.contactFirstName} />
        <Input label="Last name" name="contactLastName" autoComplete="family-name" required defaultValue={v.contactLastName} />
        <Input label="Email" name="contactEmail" type="email" autoComplete="email" required defaultValue={v.contactEmail} />
        <Input label="Mobile" name="contactPhone" type="tel" autoComplete="tel" required defaultValue={v.contactPhone} />
      </Fieldset>

      <Fieldset legend="Health & emergency">
        <div key={who} className="contents">
        <div className="sm:col-span-2">
          <Field label="Medical conditions, allergies or injuries" hint="Shared only with the player’s coaches.">
            <textarea name="medical" rows={2} className={inputCls} defaultValue={v.medical ?? kid?.medical ?? ''} />
          </Field>
        </div>
        <Input label="Emergency contact name" name="emergencyName" required defaultValue={v.emergencyName ?? kid?.emergencyName ?? ''} />
        <Input label="Emergency contact phone" name="emergencyPhone" type="tel" required defaultValue={v.emergencyPhone ?? kid?.emergencyPhone ?? ''} />
        <label className="flex items-start gap-3 text-sm sm:col-span-2">
          <input type="checkbox" name="photoConsent" defaultChecked={v.photoConsent ? v.photoConsent === 'on' : !!kid?.photoConsent} className="mt-1" />
          <span>I consent to photos/video of this player being used in Academy communications.</span>
        </label>
        </div>
      </Fieldset>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="terms" required defaultChecked={v.terms === 'on'} className="mt-1" />
        <span>I agree to the <PolicyLink k="codeOfConduct">Code of Conduct</PolicyLink>, <PolicyLink k="childSafe">Child Safe policy</PolicyLink> and <PolicyLink k="refunds">refund policy</PolicyLink>, and confirm the details above are correct.</span>
      </label>

      {state.error && (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 [[data-brand=academy]_&]:text-red-300">
          {state.error}
        </p>
      )}
      <Submit label={interest ? 'Register interest · no charge' : total != null ? `Continue to payment · ${aud(total)}` : 'Continue to payment'} />
      {!interest && <p className="text-center text-xs text-muted">Secure payment by Stripe · Paid to {props.payeeLabel}</p>}
    </form>
  )
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-accent px-6 py-4 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60 [[data-brand=academy]_&]:rounded-none [[data-brand=academy]_&]:uppercase [[data-brand=academy]_&]:tracking-[0.18em]"
    >
      {pending ? 'Please wait…' : label}
    </button>
  )
}
