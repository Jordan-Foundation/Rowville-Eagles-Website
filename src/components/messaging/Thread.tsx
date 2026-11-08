'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export type ThreadMessage = { id: number; mine: boolean; note: boolean; author: string; body: string; at: string; how: string }
export type SendState = { error?: string; sent?: string; key?: number }
type Action = (prev: SendState, fd: FormData) => Promise<SendState>

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** A conversation: messages oldest → newest, a reply box, and a quiet refresh every 15 seconds. */
export function Thread({ messages, action, hidden, placeholder, hint, empty }: { messages: ThreadMessage[]; action: Action; hidden?: Record<string, string | number>; placeholder: string; hint?: string; empty: string }) {
  const router = useRouter()
  const [state, send, pending] = useActionState<SendState, FormData>(action, {})
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === 'visible' && router.refresh(), 15_000)
    return () => clearInterval(t)
  }, [router])
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' })
  }, [messages.length])
  useEffect(() => {
    if (state.sent) setText('')
  }, [state.key, state.sent])
  return (
    <div>
      <ol className="max-h-[60vh] space-y-3 overflow-y-auto border border-line p-4" aria-label="Messages">
        {messages.length === 0 && <li className="text-sm text-muted">{empty}</li>}
        {messages.map((m) =>
          m.note ? (
            <li key={m.id} className="text-center text-xs text-muted">{m.body} · {fmt(m.at)}</li>
          ) : (
            <li key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] border px-4 py-3 text-sm ${m.mine ? 'border-line bg-surface-2' : 'border-line'}`}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className="mt-1.5 text-[11px] text-muted">{m.author} · {fmt(m.at)}{m.how ? ` · ${m.how}` : ''}</p>
              </div>
            </li>
          ),
        )}
        <div ref={end} />
      </ol>
      <form action={send} className="mt-4 space-y-2">
        {Object.entries(hidden ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <label className="block text-sm">
          <span className="sr-only">Message</span>
          <textarea name="body" rows={3} required maxLength={1200} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className="block w-full border border-line bg-transparent px-3 py-2.5 text-sm" />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">{hint}</p>
          <button disabled={pending || !text.trim()} className="bg-ink px-5 py-2.5 text-sm font-semibold text-surface disabled:opacity-50">{pending ? 'Sending…' : 'Send'}</button>
        </div>
        {state.error && <p role="alert" className="text-sm text-red-500">{state.error}</p>}
        {state.sent && <p role="status" className="text-sm text-emerald-500">{state.sent}</p>}
      </form>
    </div>
  )
}
