'use client'

import { useActionState, useState } from 'react'
import { addPlayerAction, subscribeAction, type AddPlayerState, type SubscribeState } from './actions'

const field = 'border border-[#0b0b0c]/25 bg-white px-3 py-2.5 text-sm'

export function SubscribeForm({ players, plans, initialPlan, initialPlayer }: { players: { id: number; name: string; note: string; disabled: boolean; discount: boolean }[]; plans: { key: string; label: string; price: string }[]; initialPlan: string; initialPlayer?: number }) {
  const [state, action, pending] = useActionState<SubscribeState, FormData>(subscribeAction, {})
  const [plan, setPlan] = useState(initialPlan)
  const [player, setPlayer] = useState(String(initialPlayer ?? players.find((p) => !p.disabled)?.id ?? ''))
  const chosen = players.find((p) => String(p.id) === player)
  return (
    <form action={action} className="space-y-8">
      <fieldset>
        <legend className="fp-label text-xs text-[#0b0b0c]/60">1 · Player</legend>
        <div className="mt-3 grid gap-2">
          {players.map((p) => (
            <label key={p.id} className={`flex items-center justify-between gap-3 border px-4 py-3 ${p.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} has-[:checked]:border-[#0b0b0c] has-[:checked]:ring-1 has-[:checked]:ring-[#0b0b0c]`}>
              <span className="flex items-center gap-3">
                <input type="radio" name="player" value={p.id} disabled={p.disabled} checked={player === String(p.id)} onChange={() => setPlayer(String(p.id))} />
                <span className="font-semibold">{p.name}</span>
              </span>
              <span className="text-xs text-[#0b0b0c]/60">{p.note}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="fp-label text-xs text-[#0b0b0c]/60">2 · Plan</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {plans.map((pl) => (
            <label key={pl.key} className="flex cursor-pointer items-center justify-between gap-3 border px-4 py-3 has-[:checked]:border-[#0b0b0c] has-[:checked]:ring-1 has-[:checked]:ring-[#0b0b0c]">
              <span className="flex items-center gap-3"><input type="radio" name="plan" value={pl.key} checked={plan === pl.key} onChange={() => setPlan(pl.key)} /> <span className="font-semibold">{pl.label}</span></span>
              <span className="text-sm">{pl.price}</span>
            </label>
          ))}
        </div>
        {chosen?.discount && <p className="mt-3 text-sm font-semibold">✓ 2nd-player discount applied at checkout</p>}
      </fieldset>
      <button disabled={pending || !player} className="fp-label w-full bg-[#0b0b0c] px-6 py-4 text-xs text-white transition hover:bg-[#0b0b0c]/85 disabled:opacity-50">{pending ? 'Starting secure checkout…' : 'Continue to secure payment'}</button>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <p className="text-xs text-[#0b0b0c]/60">Payment by Stripe to Foundation Sports Australia Pty Ltd. Cancel any time from the player page — you keep access until the end of the period.</p>
    </form>
  )
}

export function AddPlayer() {
  const [state, action, pending] = useActionState<AddPlayerState, FormData>(addPlayerAction, {})
  return (
    <details className="border border-dashed border-[#0b0b0c]/30 p-4" open={state.error ? true : undefined}>
      <summary className="cursor-pointer text-sm font-semibold">+ Add a player</summary>
      <form action={action} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_10rem_auto]">
        <input name="firstName" required placeholder="First name" className={field} aria-label="First name" />
        <input name="lastName" required placeholder="Last name" className={field} aria-label="Last name" />
        <input name="dob" type="date" required className={field} aria-label="Date of birth" />
        <button disabled={pending} className="fp-label bg-[#0b0b0c] px-4 text-xs text-white disabled:opacity-50">Add</button>
        {state.error && <p role="alert" className="text-sm text-red-700 sm:col-span-4">{state.error}</p>}
        {state.done && <p role="status" className="text-sm text-emerald-700 sm:col-span-4">{state.done}</p>}
      </form>
    </details>
  )
}
