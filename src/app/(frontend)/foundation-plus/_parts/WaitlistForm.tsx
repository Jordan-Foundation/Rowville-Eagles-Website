'use client'

import { useActionState } from 'react'
import { joinWaitlist, type WaitlistState } from '../waitlist-actions'

/** Email-only form. The hidden "website" field is a honeypot for bots; the stamp proves the page was really loaded. */
export function WaitlistForm({ stamp, live, source = 'foundation-plus', mode = 'trial' }: { stamp: string; live: boolean; source?: string; mode?: 'trial' | 'join' }) {
  const [state, action, pending] = useActionState<WaitlistState, FormData>(joinWaitlist, {})
  if (state.done) {
    return (
      <p role="status" className="border border-white/30 p-5 text-lg">
        ✓ {live ? 'Check your email — we’ve sent you a secure link to get started.' : 'You’re on the list! We’ll email you when Foundation+ launches, with a link to claim your free month.'}
      </p>
    )
  }
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row" noValidate>
      <input type="hidden" name="stamp" value={stamp} />
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="mode" value={mode} />
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label htmlFor={`fp-email-${source}`} className="sr-only">Email address</label>
      <input
        id={`fp-email-${source}`}
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="Your email"
        className="min-w-0 flex-1 border border-white/40 bg-transparent px-4 py-3.5 text-white placeholder:text-white/50 focus:border-white focus:outline-none"
      />
      <button disabled={pending} className="fp-label bg-white px-6 py-3.5 text-xs text-[#0b0b0c] transition hover:bg-white/85 disabled:opacity-60">
        {pending ? 'Sending…' : live ? (mode === 'join' ? 'Email me a link' : 'Send my link') : 'Join the waitlist'}
      </button>
      {state.error && <p role="alert" className="text-sm text-red-300 sm:basis-full">{state.error}</p>}
    </form>
  )
}
