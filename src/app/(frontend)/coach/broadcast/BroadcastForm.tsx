'use client'

import { useActionState, useState } from 'react'
import { broadcastAction, type BroadcastState } from './actions'

export function BroadcastForm({ to, count, templates, send = broadcastAction }: { to: string; count: number; templates: { label: string; text: string }[]; send?: (prev: BroadcastState, fd: FormData) => Promise<BroadcastState> }) {
  const [state, action, pending] = useActionState<BroadcastState, FormData>(send, {})
  const [text, setText] = useState('')
  if (state.done) return <p role="status" className="panel border border-white/40 p-5">{state.done}</p>
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="to" value={to} />
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="Quick replies">
        {templates.map((t) => <button key={t.label} type="button" onClick={() => setText(t.text)} className="shrink-0 border border-line px-3 py-1.5 text-xs font-semibold hover:border-white">{t.label}</button>)}
      </div>
      <label className="block text-sm">
        Message
        <textarea name="body" required rows={4} maxLength={1200} value={text} onChange={(e) => setText(e.target.value)} className="mt-1 block w-full border border-line bg-transparent px-3 py-2.5" placeholder="e.g. Training is on as normal tonight — see you at 5." />
      </label>
      <p className="text-xs text-muted">{text.length}/1200 · signed with your name · texts over 160 characters are sent as 2+ messages</p>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="confirm" className="mt-1" />
        <span>Send this to all {count} famil{count === 1 ? 'y' : 'ies'} listed.</span>
      </label>
      {state.error && <p role="alert" className="text-sm text-red-300">{state.error}</p>}
      <button disabled={pending || !text.trim() || count === 0} className="min-h-11 bg-white px-6 text-sm font-semibold uppercase tracking-[0.15em] text-black disabled:opacity-50">{pending ? 'Sending…' : `Send to ${count} famil${count === 1 ? 'y' : 'ies'}`}</button>
    </form>
  )
}
