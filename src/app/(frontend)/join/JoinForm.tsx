'use client'

import { PolicyLink } from '@/components/PolicyLink'
import { useActionState, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { fullLabel, groupFor, type AgeRules } from '@/lib/age-groups'
import { Field, Fieldset, Input, inputCls } from '@/components/forms/Field'
import { joinUs, type JoinState } from './actions'

/** `remaining` is keyed by year of birth */
export type TrialOption = { id: number; label: string; birthYears: number[]; remaining: Record<string, number> }

export function JoinForm({ rules, trials }: { rules: AgeRules; trials: TrialOption[] }) {
  const season = rules.season
  const [state, action] = useActionState<JoinState, FormData>(joinUs, {})
  const v = state.values ?? {}
  const [dob, setDob] = useState(v.playerDob ?? '')
  const group = useMemo(() => (dob ? groupFor(dob, rules) : null), [dob, rules])
  const ageGroup = group ? fullLabel(group) : null
  const key = group ? String(group.birthYear) : ''
  const options = group ? trials.filter((t) => t.birthYears.includes(group.birthYear)) : []
  const open = options.filter((t) => (t.remaining[key] ?? 0) > 0)

  return (
    <form action={action} className="space-y-6">
      <Fieldset legend="Player">
        <Input label="First name" name="playerFirstName" required defaultValue={v.playerFirstName} />
        <Input label="Last name" name="playerLastName" required defaultValue={v.playerLastName} />
        <Input label="Date of birth" name="playerDob" type="date" required value={dob} onChange={(e) => setDob(e.target.value)} />
        <Field label="Gender">
          <select name="gender" className={inputCls} defaultValue={v.gender ?? ''}>
            <option value="">Select…</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="non-binary">Non-binary</option>
            <option value="prefer-not-to-say">Prefer not to say</option>
          </select>
        </Field>
        <Input label="Previous club (if any)" name="previousClub" defaultValue={v.previousClub} />
        <div className="flex items-end">
          {ageGroup && (
            <p className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-sm" aria-live="polite">
              {season} age group: <strong>{ageGroup}</strong>
              {group?.kind === 'too-young' && <span className="mt-1 block text-xs text-muted">Younger than our MiniRoos {rules.miniMin}s — register interest and the club will be in touch.</span>}
            </p>
          )}
        </div>
      </Fieldset>

      <Fieldset legend="Parent / guardian">
        <Input label="First name" name="contactFirstName" autoComplete="given-name" required defaultValue={v.contactFirstName} />
        <Input label="Last name" name="contactLastName" autoComplete="family-name" required defaultValue={v.contactLastName} />
        <Input label="Email" name="contactEmail" type="email" autoComplete="email" required defaultValue={v.contactEmail} />
        <Input label="Mobile" name="contactPhone" type="tel" autoComplete="tel" required defaultValue={v.contactPhone} />
        <div className="sm:col-span-2">
          <Field label="Anything we should know? (optional)">
            <textarea name="notes" rows={2} className={inputCls} defaultValue={v.notes} />
          </Field>
        </div>
      </Fieldset>

      {ageGroup && (
        <fieldset className="panel rounded-2xl border border-line bg-surface-2 p-6">
          <legend className="px-2 font-display text-lg font-semibold uppercase tracking-wide">Trial night</legend>
          {open.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {options.map((t) => {
                const left = t.remaining[key] ?? 0
                return (
                  <label
                    key={t.id}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm transition has-[:checked]:border-brand has-[:checked]:ring-1 has-[:checked]:ring-brand ${left === 0 ? 'pointer-events-none opacity-40' : ''}`}
                  >
                    <span className="flex items-center gap-3">
                      <input type="radio" name="trialSession" value={t.id} required disabled={left === 0} defaultChecked={v.trialSession === String(t.id)} />
                      {t.label}
                    </span>
                    <span className="text-xs text-muted">{left === 0 ? 'Full' : `${left} places`}</span>
                  </label>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted">
              Trial dates for <strong className="text-ink">{ageGroup}</strong> haven’t been set yet. Submit this form to register your interest — we’ll email
              you as soon as dates are announced, with a link to choose a night.
            </p>
          )}
        </fieldset>
      )}

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="consent" required defaultChecked={v.consent === 'on'} className="mt-1" />
        <span>I agree to Rowville Eagles FC contacting me about trials and the {season} season, and to the club’s <PolicyLink k="privacy">privacy policy</PolicyLink>.</span>
      </label>

      {state.error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">{state.error}</p>}
      <Submit label={ageGroup && open.length > 0 ? 'Book trial' : 'Register interest'} />
    </form>
  )
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="w-full rounded-full bg-accent px-6 py-4 font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-60">
      {pending ? 'Sending…' : label}
    </button>
  )
}
