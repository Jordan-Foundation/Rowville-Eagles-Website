'use client'

import { useActionState, useState } from 'react'
import { REFERRAL_PROGRAMS } from '@/referrals/programs'
import { claimRewardAction, getInviteLink, type ClaimState, type InviteState } from './actions'

const input = 'mt-1 block w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-ink outline-none focus:border-ink'

/** Copy + share (WhatsApp, the phone's share sheet). */
export function ShareLink({ link, text }: { link: string; text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
  }
  const share = async () => {
    try { await navigator.share({ title: 'Rowville football', text, url: link }) } catch { await copy() }
  }
  return (
    <div className="space-y-2">
      <input readOnly value={link} aria-label="Your link" className={`${input} text-sm`} onFocus={(e) => e.currentTarget.select()} data-share-link />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white">{copied ? 'Copied!' : 'Copy link'}</button>
        <button type="button" onClick={share} className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold">Share…</button>
        <a href={`https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`} target="_blank" rel="noreferrer" className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold">WhatsApp</a>
        <a href={`sms:?&body=${encodeURIComponent(`${text} ${link}`)}`} className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold">Text message</a>
      </div>
    </div>
  )
}

/** Friend's details + the program you recommend → "Get link". */
export function InviteForm({ players, current }: { players: { id: number; firstName: string }[]; current: number }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(getInviteLink, {})
  return (
    <form action={action} className="space-y-4" aria-label="Invite a friend">
      {players.length > 1 ? (
        <label className="block text-sm font-medium">Who gets the credit?
          <select name="player" defaultValue={current} className={input}>{players.map((k) => <option key={k.id} value={k.id}>{k.firstName}</option>)}</select>
        </label>
      ) : <input type="hidden" name="player" value={current} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium">Friend’s name<input name="name" className={input} placeholder="e.g. Jess" /></label>
        <label className="block text-sm font-medium">Their email<input name="email" type="email" className={input} /></label>
        <label className="block text-sm font-medium">or mobile<input name="phone" type="tel" className={input} /></label>
      </div>
      <p className="text-xs text-muted">We only use these to recognise your friend when they sign up — we never contact them.</p>
      <fieldset>
        <legend className="text-sm font-medium">What would suit them?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {REFERRAL_PROGRAMS.map((x, i) => (
            <label key={x.value} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-4 py-3 text-sm has-[:checked]:border-brand has-[:checked]:ring-1 has-[:checked]:ring-brand">
              <input type="radio" name="featured" value={x.value} defaultChecked={i === 0} />{x.label}
            </label>
          ))}
        </div>
      </fieldset>
      {state.error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm">{state.error}</p>}
      <button disabled={pending} className="rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink hover:brightness-110 disabled:opacity-60">{pending ? 'Making your link…' : 'Get link'}</button>
      {state.link && (
        <div className="rounded-2xl border-2 border-accent p-4" role="status">
          <p className="mb-2 font-semibold">Here’s {state.name ? `${state.name}’s` : 'your'} link — send it however you like:</p>
          <ShareLink link={state.link} text="Thought you'd love this — come and play at Rowville!" />
        </div>
      )}
    </form>
  )
}

export function ClaimForm({ grant, sizes }: { grant: number; sizes: string[] }) {
  const [state, action, pending] = useActionState<ClaimState, FormData>(claimRewardAction, {})
  if (state.done) return <p role="status" className="text-sm font-semibold text-emerald-700">{state.done}</p>
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="grant" value={grant} />
      {sizes.length > 0 && (
        <select name="size" required aria-label="Size" defaultValue="" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
          <option value="" disabled>Choose a size</option>
          {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      )}
      <button disabled={pending} className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">Claim</button>
      {state.error && <span role="alert" className="text-sm text-red-700">{state.error}</span>}
    </form>
  )
}
