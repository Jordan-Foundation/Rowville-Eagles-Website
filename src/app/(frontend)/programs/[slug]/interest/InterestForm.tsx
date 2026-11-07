'use client'

import { useActionState, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Field, Fieldset, Input, inputCls } from '@/components/forms/Field'
import { fullLabel, groupFor, type AgeRules } from '@/lib/age-groups'
import { registerTournamentInterest, type InterestState } from './actions'

type Props = {
  slug: string
  title: string
  rules: AgeRules
  me: { firstName?: string | null; lastName?: string | null; email: string; phone?: string | null } | null
  players: { id: number; name: string; dob: string }[]
}

export function InterestForm({ slug, title, rules, me, players }: Props) {
  const [state, action] = useActionState<InterestState, FormData>(registerTournamentInterest, {})
  const v = state.values ?? {}
  const [who, setWho] = useState(v.participant ?? (players[0] ? String(players[0].id) : 'new'))
  const [dob, setDob] = useState(v.playerDob ?? '')
  const chosen = players.find((pl) => String(pl.id) === who)
  const group = useMemo(() => groupFor(chosen ? chosen.dob : dob, rules), [chosen, dob, rules])
  const newPlayer = !me || who === 'new'

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="slug" value={slug} />
      <Fieldset legend="Player">
        {me && players.length > 0 && (
          <div className="sm:col-span-2">
            <Field label="Who is registering interest?">
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
          </>
        )}
        <Input label="Current club (if any)" name="club" defaultValue={v.club} />
        <div className="flex items-end">
          {group && (
            <p className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-sm" aria-live="polite">
              Age group: <strong>{fullLabel(group)}</strong>
              {group.kind !== 'miniroos' && <span className="mt-1 block text-xs text-muted">Outside MiniRoos ages — you can still register and we’ll be in touch.</span>}
            </p>
          )}
        </div>
      </Fieldset>

      {me ? (
        <div className="rounded-2xl border border-line p-5 text-sm">
          <p className="text-muted">Contact</p>
          <p className="mt-1 font-semibold">{[me.firstName, me.lastName].filter(Boolean).join(' ') || me.email} · {me.email}</p>
          {!me.phone && <div className="mt-4 max-w-xs"><Input label="Mobile" name="contactPhone" type="tel" required defaultValue={v.contactPhone} /></div>}
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
          <Input label="Mobile" name="contactPhone" type="tel" autoComplete="tel" required placeholder="0412 345 678" defaultValue={v.contactPhone} />
        </Fieldset>
      )}

      <Field label="Anything the coaches should know? (optional)">
        <textarea name="notes" rows={2} className={inputCls} defaultValue={v.notes} />
      </Field>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="consent" required defaultChecked={v.consent === 'on'} className="mt-1" />
        <span>I agree to be contacted by email and SMS about {title}, including selection outcomes.</span>
      </label>

      {state.error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">{state.error}</p>}
      <Submit />
      <p className="text-center text-xs text-muted">No payment now — if selected, you’ll be emailed a link to complete registration.</p>
    </form>
  )
}

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="w-full rounded-full bg-accent px-6 py-4 font-semibold text-accent-ink hover:brightness-110 disabled:opacity-60">
      {pending ? 'Sending…' : 'Register interest'}
    </button>
  )
}
