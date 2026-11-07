'use client'

import { useActionState } from 'react'
import { privacyAction, type PrivacyState } from '../actions'

export function PrivacyForm({ player, show, name, fallback }: { player: number; show: boolean; name: string; fallback: string }) {
  const [state, action, pending] = useActionState<PrivacyState, FormData>(privacyAction, {})
  return (
    <form action={action} className="flex flex-wrap items-end gap-4 text-sm">
      <input type="hidden" name="player" value={player} />
      <label className="flex items-center gap-2"><input type="checkbox" name="show" defaultChecked={show} /> Show on leaderboards</label>
      <label>Name on leaderboards<input name="name" defaultValue={name} placeholder={fallback} maxLength={20} className="mt-1 block w-44 border border-line bg-black/40 px-2 py-1.5" /></label>
      <button disabled={pending} className="border border-line px-4 py-2 font-semibold">{pending ? 'Saving…' : 'Save'}</button>
      {state.error && <p role="alert" className="basis-full text-red-300">{state.error}</p>}
      {state.done && <p role="status" className="basis-full text-emerald-300">{state.done}</p>}
    </form>
  )
}
