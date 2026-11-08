'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { inputCls } from '@/components/forms/Field'
import { WEEKDAYS } from '@/academy/constants'
import { previewReschedule, submitReschedule, type ReschedulePreview, type StaffActionState } from '../actions'

type Props = {
  bookingId: number
  type: 'casual' | 'term'
  sessions: { id: number; label: string }[]
  coaches: { id: number; name: string }[]
  coachId: number
  weekday?: string | null
  time?: string | null
}

const fmt = (iso: string) => new Date(iso).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const field = `${inputCls} mt-1 rounded-none`

export function ReschedulePanel(p: Props) {
  const [f, setF] = useState<Record<string, string>>({
    kind: p.type === 'term' ? 'term' : 'session',
    session: String(p.sessions[0]?.id ?? ''),
    fromSession: String(p.sessions[0]?.id ?? ''),
    weekday: p.weekday ?? 'Monday',
    time: p.time ?? '16:00',
    date: '',
    coach: String(p.coachId),
  })
  const [preview, setPreview] = useState<ReschedulePreview | null>(null)
  const [, start] = useTransition()
  const [state, action, pending] = useActionState<StaffActionState, FormData>(submitReschedule, {})
  const set = (k: string) => (e: { target: { value: string } }) => setF((cur) => ({ ...cur, [k]: e.target.value }))

  useEffect(() => {
    if (f.kind === 'session' && !f.date) return setPreview(null)
    start(async () => setPreview(await previewReschedule(p.bookingId, f)))
  }, [f, p.bookingId])

  if (!p.sessions.length) return <p className="text-sm text-muted">No upcoming sessions to move.</p>
  const ok = preview && !('error' in preview) && preview.errors.length === 0 && preview.moves.length > 0

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="bookingId" value={p.bookingId} />
      {Object.entries(f).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}

      {p.type === 'term' && (
        <div className="flex flex-wrap gap-2">
          {[['term', 'Rest of the term'], ['session', 'One session']].map(([v, label]) => (
            <button type="button" key={v} onClick={() => setF((cur) => ({ ...cur, kind: v }))} aria-pressed={f.kind === v} className={`px-4 py-2 text-sm font-semibold ${f.kind === v ? 'bg-white text-black' : 'border border-line'}`}>{label}</button>
          ))}
        </div>
      )}

      {f.kind === 'term' ? (
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-sm sm:col-span-2">From
            <select value={f.fromSession} onChange={set('fromSession')} className={field}>{p.sessions.map((s) => <option key={s.id} value={s.id}>{s.label} onwards</option>)}</select>
          </label>
          <label className="text-sm">New day
            <select value={f.weekday} onChange={set('weekday')} className={field}>{WEEKDAYS.map((d) => <option key={d}>{d}</option>)}</select>
          </label>
          <label className="text-sm">New time<input type="time" step={1800} value={f.time} onChange={set('time')} className={field} /></label>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-sm sm:col-span-2">Session
            <select value={f.session} onChange={set('session')} className={field}>{p.sessions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
          </label>
          <label className="text-sm">New date<input type="date" value={f.date} onChange={set('date')} className={field} /></label>
          <label className="text-sm">New time<input type="time" step={1800} value={f.time} onChange={set('time')} className={field} /></label>
        </div>
      )}
      <label className="block max-w-xs text-sm">Coach
        <select value={f.coach} onChange={set('coach')} className={field}>{p.coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </label>

      {preview && (
        <div className="border border-line p-5" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Preview</p>
          {'error' in preview ? (
            <p className="mt-2 text-sm text-amber-300">{preview.error}</p>
          ) : (
            <>
              <ol className="mt-3 space-y-1 text-sm">
                {preview.moves.map((m) => (
                  <li key={m.sessionId}><span className="text-muted line-through">{fmt(m.from)}</span> → <strong>{fmt(m.to)}</strong> · {m.coach}</li>
                ))}
              </ol>
              {preview.errors.map((e) => <p key={e} className="mt-2 text-sm text-red-300">✕ {e}</p>)}
              {preview.warnings.map((w) => <p key={w} className="mt-2 text-sm text-amber-300">! {w}</p>)}
            </>
          )}
        </div>
      )}

      <label className="block text-sm">Reason (kept on the booking)<textarea name="reason" required rows={2} className={field} placeholder="e.g. Family asked to move to Thursdays" /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify" defaultChecked /> Email the family and coach</label>
      {state.error && <p role="alert" className="border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{state.error}</p>}
      <button disabled={pending || !ok} className="bg-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-black disabled:opacity-40">
        {pending ? 'Moving…' : `Move ${ok ? (preview as { moves: unknown[] }).moves.length : ''} session${ok && (preview as { moves: unknown[] }).moves.length === 1 ? '' : 's'}`}
      </button>
    </form>
  )
}
