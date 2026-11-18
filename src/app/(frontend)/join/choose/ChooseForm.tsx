'use client'

import { useActionState } from 'react'
import { chooseTrial, type JoinState } from '../actions'
import type { TrialOption } from '../JoinForm'

export function ChooseForm({ refCode, token, birthYear, options }: { refCode: string; token: string; birthYear: number; options: TrialOption[] }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(chooseTrial, {})
  // The first night with places is picked for them — one tap to confirm, or change it
  const first = options.find((t) => (t.remaining[String(birthYear)] ?? 0) > 0)?.id
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="ref" value={refCode} />
      <input type="hidden" name="token" value={token} />
      <p className="text-sm text-muted">{options.length > 1 ? 'We’ve picked the first night for you — tap Confirm, or choose a different night (or add a second one).' : 'Tap Confirm to book this night.'}</p>
      <div className="grid gap-2 sm:grid-cols-2" onChange={(e) => { const t = e.target as HTMLInputElement; if (t.checked && e.currentTarget.querySelectorAll('input[name=trialSession]:checked').length > 2) t.checked = false }}>
        {options.map((t) => {
          const left = t.remaining[String(birthYear)] ?? 0
          return (
            <label key={t.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line px-4 py-3 text-sm has-[:checked]:border-brand has-[:checked]:ring-1 has-[:checked]:ring-brand ${left === 0 ? 'pointer-events-none opacity-40' : ''}`}>
              <span className="flex items-center gap-3"><input type="checkbox" name="trialSession" value={t.id} disabled={left === 0} defaultChecked={t.id === first} />{t.label}</span>
              <span className="text-xs text-muted">{left === 0 ? 'Full' : `${left} places`}</span>
            </label>
          )
        })}
      </div>
      {state.error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-full bg-accent px-6 py-4 font-semibold text-accent-ink hover:brightness-110 disabled:opacity-60">{pending ? 'Confirming…' : 'Confirm my trial spot'}</button>
    </form>
  )
}
