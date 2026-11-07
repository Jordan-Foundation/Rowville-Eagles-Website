'use client'

import { useActionState, useState } from 'react'
import { createAccountAction, startTrialAction, type StartState } from './actions'

const field = 'mt-1 block w-full border border-[#0b0b0c]/25 bg-white px-3 py-2.5 text-sm'
const btn = 'fp-label w-full bg-[#0b0b0c] px-6 py-4 text-xs text-white transition hover:bg-[#0b0b0c]/85 disabled:opacity-50'

export function CreateAccount({ token, email, service, marketing }: { token: string; email: string; service: string; marketing: string }) {
  const [state, action, pending] = useActionState<StartState, FormData>(createAccountAction, {})
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm">Email: <strong>{email}</strong></p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Your first name<input name="firstName" required autoComplete="given-name" className={field} /></label>
        <label className="text-sm">Last name<input name="lastName" required autoComplete="family-name" className={field} /></label>
      </div>
      <label className="block text-sm">Mobile<input name="phone" type="tel" required autoComplete="tel" placeholder="04xx xxx xxx" className={field} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Password<input name="password" type="password" required minLength={8} autoComplete="new-password" className={field} /></label>
        <label className="text-sm">Confirm password<input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={field} /></label>
      </div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="service" required className="mt-1" /> <span>{service}</span></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="marketing" className="mt-1" /> <span>{marketing}</span></label>
      <button disabled={pending} className={btn}>{pending ? 'Setting up…' : 'Create my account'}</button>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    </form>
  )
}

export function StartTrial({ token, players, trialDays, price }: { token: string; players: { id: number; name: string; ok: boolean; note: string }[]; trialDays: number; price: string }) {
  const [state, action, pending] = useActionState<StartState, FormData>(startTrialAction, {})
  const [player, setPlayer] = useState(String(players.find((p) => p.ok)?.id ?? ''))
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="grid gap-2">
        {players.map((p) => (
          <label key={p.id} className={`flex items-center justify-between gap-3 border px-4 py-3 has-[:checked]:border-[#0b0b0c] has-[:checked]:ring-1 has-[:checked]:ring-[#0b0b0c] ${p.ok ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
            <span className="flex items-center gap-3"><input type="radio" name="player" value={p.id} disabled={!p.ok} checked={player === String(p.id)} onChange={() => setPlayer(String(p.id))} /> <span className="font-semibold">{p.name}</span></span>
            <span className="text-xs text-[#0b0b0c]/60">{p.note}</span>
          </label>
        ))}
      </div>
      <button disabled={pending || !player} className={btn}>{pending ? 'Starting secure checkout…' : `Start my ${trialDays}-day free month`}</button>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <p className="text-xs text-[#0b0b0c]/60">A card is needed to start. Nothing is charged today. We’ll email you 7 days before the free month ends; if you don’t cancel, it continues as Premium at {price}/month. One free month per family.</p>
    </form>
  )
}
