'use client'

import { useActionState } from 'react'
import { chooseTrial, type JoinState } from '../actions'
import type { TrialOption } from '../JoinForm'

export function ChooseForm({ refCode, token, ageGroup, options }: { refCode: string; token: string; ageGroup: string; options: TrialOption[] }) {
  const [state, action] = useActionState<JoinState, FormData>(chooseTrial, {})
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="ref" value={refCode} />
      <input type="hidden" name="token" value={token} />
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((t) => {
          const left = t.remaining[ageGroup] ?? 0
          return (
            <label key={t.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line px-4 py-3 text-sm has-[:checked]:border-brand has-[:checked]:ring-1 has-[:checked]:ring-brand ${left === 0 ? 'pointer-events-none opacity-40' : ''}`}>
              <span className="flex items-center gap-3"><input type="radio" name="trialSession" value={t.id} required disabled={left === 0} />{t.label}</span>
              <span className="text-xs text-muted">{left === 0 ? 'Full' : `${left} places`}</span>
            </label>
          )
        })}
      </div>
      {state.error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">{state.error}</p>}
      <button type="submit" className="w-full rounded-full bg-accent px-6 py-4 font-semibold text-accent-ink hover:brightness-110">Confirm trial night</button>
    </form>
  )
}
