'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { PayeeChip } from '@/components/PayeeChip'
import { PolicyLink } from '@/components/PolicyLink'
import { PlayerFields } from '@/components/forms/PlayerFields'
import { Fieldset, Input } from '@/components/forms/Field'
import type { KidOption } from '@/lib/family-kids'
import { bookFullYear, type YearState } from './year-actions'

export type YearOptionView = { key: string; slotIds: string; birthYear: number; label: string; terms: { title: string; price: number; label: string }[]; sum: number; total: number; saving: number; pct: number }
const aud = (n: number) => n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: n % 1 ? 2 : 0 })

/** Full year: the player's year of birth picks the Term 1 training times; the price shows term by term. */
export function FullYearForm(props: { slug: string; options: YearOptionView[]; payeeLabel: string; feeNote: string; prefill?: Record<string, string>; kids?: KidOption[] }) {
  const [state, action] = useActionState<YearState, FormData>(bookFullYear, {})
  const v = { ...props.prefill, ...state.values }
  const kids = props.kids ?? []
  const [dob, setDob] = useState(v.playerDob ?? (kids[0]?.dob ?? ''))
  const year = /^\d{4}-\d{2}-\d{2}$/.test(dob) ? Number(dob.slice(0, 4)) : null
  const fits = year ? props.options.filter((o) => o.birthYear === year) : []
  const [picked, setPicked] = useState(v.option ?? '')
  const chosen = fits.length === 1 ? fits[0] : fits.find((o) => o.slotIds === picked)
  return (
    <form action={action} className="space-y-6" onChange={(e) => { const t = e.target as unknown as HTMLInputElement; if (t.name === 'playerDob') setDob(t.value); if (t.name === '$who') { const k = kids.find((x) => String(x.id) === t.value); setDob(k?.dob ?? '') } }}>
      <input type="hidden" name="program" value={props.slug} />
      <PlayerFields kids={kids} values={v} />
      <fieldset className="panel border border-line p-5">
        <legend className="px-2 font-display text-lg font-semibold uppercase tracking-wide">Term 1 training time</legend>
        {!year ? <p className="text-sm text-muted">Enter the player’s date of birth to see their training times.</p> : fits.length === 0 ? <p className="text-sm">There isn’t a Term 1 training time with room for players born in {year} — please contact us.</p> : (
          <div className="grid gap-2">
            {fits.map((o) => (
              <label key={o.key} className="flex cursor-pointer items-start gap-3 border border-line px-4 py-3 text-sm has-[:checked]:border-ink">
                <input type="radio" name="option" value={o.slotIds} required checked={fits.length === 1 || picked === o.slotIds} onChange={() => setPicked(o.slotIds)} className="mt-1" />
                <span><span className="block font-semibold">{o.label}</span><span className="block text-xs text-muted">Terms 2–4 on the same night and time where it runs</span></span>
              </label>
            ))}
          </div>
        )}
        {chosen && (
          <table className="mt-4 w-full text-sm" aria-label="Full-year price">
            <tbody>
              {chosen.terms.map((t) => <tr key={t.title} className="border-t border-line"><th scope="row" className="py-1.5 text-left font-normal">{t.title}<span className="block text-xs text-muted">{t.label}</span></th><td className="text-right">{aud(t.price)}</td></tr>)}
              <tr className="border-t border-line"><th scope="row" className="py-1.5 text-left font-normal text-muted">Four terms</th><td className="text-right text-muted">{aud(chosen.sum)}</td></tr>
              <tr><th scope="row" className="py-1.5 text-left font-semibold">Full year ({chosen.pct}% off)</th><td className="text-right font-display text-2xl font-semibold">{aud(chosen.total)}</td></tr>
            </tbody>
          </table>
        )}
        {chosen && chosen.saving > 0 && <p className="mt-2 text-sm text-emerald-300">You save {aud(chosen.saving)} on paying term by term.</p>}
      </fieldset>
      <Fieldset legend="Parent / guardian">
        <Input label="First name" name="contactFirstName" required defaultValue={v.contactFirstName} />
        <Input label="Last name" name="contactLastName" required defaultValue={v.contactLastName} />
        <Input label="Email" name="contactEmail" type="email" required defaultValue={v.contactEmail} />
        <Input label="Mobile" name="contactPhone" type="tel" required defaultValue={v.contactPhone} />
      </Fieldset>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="terms" required className="mt-1" />
        <span>I agree to the <PolicyLink k="academyTerms">Foundation Academy terms</PolicyLink>, <PolicyLink k="codeOfConduct">Code of Conduct</PolicyLink> and <PolicyLink k="childSafe">Child Safe policy</PolicyLink>.</span>
      </label>
      <p role="note" className="text-sm text-muted">{props.feeNote}</p>
      {state.error && <p role="alert" className="border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{state.error}</p>}
      <PayeeChip label={props.payeeLabel} />
      <Submit label={chosen ? `Continue to payment · ${aud(chosen.total)}` : 'Continue to payment'} />
    </form>
  )
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={pending} className="w-full bg-accent px-6 py-4 font-semibold uppercase tracking-[0.18em] text-accent-ink disabled:opacity-60">{pending ? 'Starting secure checkout…' : label}</button>
}
