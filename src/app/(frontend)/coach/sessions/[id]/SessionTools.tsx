'use client'

import { useActionState, useState } from 'react'
import { inputCls } from '@/components/forms/Field'
import { markAttendance, needCover, runningLate, saveCoachNotes, type CoachSessionState } from '../actions'

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

/** Running late (tells the family) and Need cover (asks Management). */
export function SessionHelp({ id, canCover, needsCover }: { id: number; canCover: boolean; needsCover: boolean }) {
  const [late, lateAction, latePending] = useActionState<CoachSessionState, FormData>(runningLate, {})
  const [cover, coverAction, coverPending] = useActionState<CoachSessionState, FormData>(needCover, {})
  const [open, setOpen] = useState(false)
  return (
    <div className="space-y-4">
      <form action={lateAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <span className="text-sm font-semibold">Running late:</span>
        {[5, 10, 15].map((m) => (
          <button key={m} name="minutes" value={m} disabled={latePending} className="min-h-10 border border-line px-3 text-sm font-semibold hover:border-white disabled:opacity-60">{m} min</button>
        ))}
        {late.saved && <p role="status" className="w-full text-sm text-emerald-300">{late.saved}</p>}
        {late.error && <p role="alert" className="w-full text-sm text-red-300">{late.error}</p>}
      </form>
      {canCover && (needsCover || cover.saved ? (
        <p role="status" className="text-sm text-amber-300">{cover.saved ?? 'Cover has been requested — Management will assign a coach.'}</p>
      ) : !open ? (
        <button type="button" onClick={() => setOpen(true)} className="min-h-10 border border-amber-300/60 px-4 text-sm font-semibold text-amber-300">I can’t make this — need cover</button>
      ) : (
        <form action={coverAction} className="space-y-3 border border-amber-300/40 p-4">
          <input type="hidden" name="id" value={id} />
          <label className="block text-sm">Why? (for Management only)<input name="reason" className={`${inputCls} mt-1 rounded-none`} placeholder="e.g. sick" /></label>
          <label className="block text-sm">Handover for the cover coach<textarea name="handover" rows={3} className={`${inputCls} mt-1 rounded-none`} placeholder="What you’ve been working on, anything to know…" /></label>
          <button disabled={coverPending} className="min-h-10 bg-white px-4 text-sm font-semibold uppercase tracking-[0.12em] text-black disabled:opacity-60">{coverPending ? 'Sending…' : 'Ask for cover'}</button>
          {cover.error && <p role="alert" className="text-sm text-red-300">{cover.error}</p>}
        </form>
      ))}
    </div>
  )
}
