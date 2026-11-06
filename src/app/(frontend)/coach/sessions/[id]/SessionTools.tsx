'use client'

import { useActionState, useState } from 'react'
import { inputCls } from '@/components/forms/Field'
import { markAttendance, saveCoachNotes, type CoachSessionState } from '../actions'

export function Attendance({ id, status, open }: { id: number; status: string; open: boolean }) {
  const [state, action, pending] = useActionState<CoachSessionState, FormData>(markAttendance, {})
  if (!open) return <p className="text-sm text-muted">You can mark attendance from 15 minutes before the start.</p>
  const btn = (value: string, label: string, on: boolean) => (
    <button name="status" value={value} disabled={pending} className={`px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] disabled:opacity-60 ${on ? 'bg-white text-black' : 'border border-line hover:border-white/40'}`}>
      {label}
    </button>
  )
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap gap-2">
        {btn('completed', 'Attended', status === 'completed')}
        {btn('no_show', 'No-show', status === 'no_show')}
        {status !== 'scheduled' && btn('scheduled', 'Clear', false)}
      </div>
      {state.error && <p role="alert" className="mt-3 text-sm text-red-300">{state.error}</p>}
      {state.saved && <p role="status" className="mt-3 text-sm text-muted">{state.saved}</p>}
    </form>
  )
}

export function Notes({ id, notes, disabled }: { id: number; notes: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState<CoachSessionState, FormData>(saveCoachNotes, {})
  // Controlled, so the text stays put after saving (React resets uncontrolled fields when a form action finishes)
  const [text, setText] = useState(notes)
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <textarea name="notes" rows={5} value={text} onChange={(e) => setText(e.target.value)} disabled={disabled} className={`${inputCls} rounded-none`} placeholder="What you worked on, what to focus on next time…" />
      <div className="flex items-center gap-3">
        {!disabled && <button disabled={pending} className="bg-white px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.12em] text-black disabled:opacity-60">{pending ? 'Saving…' : 'Save notes'}</button>}
        <p className="text-xs text-muted">Private — seen by Academy coaches and admins only, never by the family.</p>
      </div>
      {state.error && <p role="alert" className="text-sm text-red-300">{state.error}</p>}
      {state.saved && <p role="status" className="text-sm text-muted">{state.saved}</p>}
    </form>
  )
}
