'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { inputCls } from '@/components/forms/Field'
import type { Outcome, Quote } from '@/academy/cancellation'
import { previewCancellation, submitCancellation, submitGoodwill, submitRetryRefund, type StaffActionState } from '../actions'

type Session = { id: number; label: string; detail: string; cancellable: boolean }

const outcomeLabel: Record<Outcome, string> = {
  refund: 'Refund to card',
  credit: 'Account credit',
  makeup: 'Free make-up session',
  none: 'No refund or credit',
}
const money = (n: number) => `$${n.toFixed(2).replace(/\.00$/, '')}`

export function CancelPanel(props: { bookingId: number; type: 'casual' | 'term'; sessions: Session[]; coaches: { id: number; name: string }[]; coachId: number; defaultTime?: string | null }) {
  const [by, setBy] = useState<'family' | 'coach'>('family')
  const [scope, setScope] = useState<'booking' | 'sessions'>(props.type === 'casual' ? 'booking' : 'sessions')
  const [ids, setIds] = useState<number[]>([])
  const [quote, setQuote] = useState<Quote | null>(null)
  const [outcome, setOutcome] = useState<Outcome | ''>('')
  const [override, setOverride] = useState(false)
  const [, start] = useTransition()
  const [state, action, pending] = useActionState<StaffActionState, FormData>(submitCancellation, {})

  useEffect(() => {
    if (scope === 'sessions' && ids.length === 0) return setQuote(null)
    start(async () => {
      const q = await previewCancellation(props.bookingId, scope, ids, by)
      if ('error' in q) return setQuote(null)
      setQuote(q)
      setOutcome((o) => (o && q.options.includes(o) ? o : q.options[0]))
    })
  }, [by, scope, ids, props.bookingId])

  const toggle = (id: number) => setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  const cancellable = props.sessions.filter((s) => s.cancellable)
  const choices: Outcome[] = quote ? (override ? (['refund', 'credit'] as Outcome[]) : quote.options) : []

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="bookingId" value={props.bookingId} />
      <input type="hidden" name="scope" value={scope} />
      <input type="hidden" name="sessionIds" value={ids.join(',')} />
      <input type="hidden" name="by" value={by} />

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Who’s cancelling?</legend>
          <div className="mt-2 flex gap-2">
            {(['family', 'coach'] as const).map((v) => (
              <button type="button" key={v} onClick={() => setBy(v)} aria-pressed={by === v} className={`px-4 py-2 text-sm font-semibold ${by === v ? 'bg-white text-black' : 'border border-line'}`}>
                {v === 'family' ? 'Family' : 'Coach / Academy'}
              </button>
            ))}
          </div>
        </fieldset>
        {props.type === 'term' && (
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">What?</legend>
            <div className="mt-2 flex gap-2">
              {(['sessions', 'booking'] as const).map((v) => (
                <button type="button" key={v} onClick={() => setScope(v)} aria-pressed={scope === v} className={`px-4 py-2 text-sm font-semibold ${scope === v ? 'bg-white text-black' : 'border border-line'}`}>
                  {v === 'booking' ? 'Whole term (all remaining)' : 'Chosen weeks'}
                </button>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      {scope === 'sessions' && (
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Sessions to cancel</legend>
          {cancellable.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No upcoming sessions left to cancel.</p>
          ) : (
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {cancellable.map((s) => (
                <li key={s.id}>
                  <label className={`flex cursor-pointer items-start gap-3 border p-3 text-sm ${ids.includes(s.id) ? 'border-white bg-white/5' : 'border-line'}`}>
                    <input type="checkbox" checked={ids.includes(s.id)} onChange={() => toggle(s.id)} className="mt-1" />
                    <span><span className="block font-medium">{s.label}</span><span className="text-muted">{s.detail}</span></span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      )}

      {quote && (
        <div className="border border-line p-5" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Policy</p>
          <p className="mt-2 font-medium">{quote.rule}</p>
          <p className="mt-2 text-sm text-muted">
            {quote.sessionIds.length} session{quote.sessionIds.length === 1 ? '' : 's'} · {money(quote.perSession)} each · back under policy: <strong className="text-ink">{money(quote.value)}</strong>
            {' '}· refundable to card: {money(quote.refundableCash)}{quote.stopWeekly && ' · weekly charges will stop'}
          </p>
          {quote.warnings.map((w) => <p key={w} className="mt-2 text-sm text-amber-300">{w}</p>)}

          <fieldset className="mt-4">
            <legend className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Outcome</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {choices.map((o) => (
                <label key={o} className={`flex cursor-pointer items-center gap-2 border px-3 py-2 text-sm ${outcome === o ? 'border-white bg-white/5' : 'border-line'}`}>
                  <input type="radio" name="outcome" value={o} checked={outcome === o} onChange={() => setOutcome(o)} />
                  {outcomeLabel[o]}
                </label>
              ))}
            </div>
          </fieldset>

          {outcome === 'makeup' && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="text-sm">Date<input type="date" name="makeUpDate" required className={`${inputCls} mt-1 rounded-none`} /></label>
              <label className="text-sm">Time<input type="time" name="makeUpTime" required step={1800} defaultValue={props.defaultTime ?? ''} className={`${inputCls} mt-1 rounded-none`} /></label>
              <label className="text-sm">Coach
                <select name="makeUpCoach" defaultValue={props.coachId} className={`${inputCls} mt-1 rounded-none`}>
                  {props.coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            </div>
          )}

          {quote.sessionIds.length > 0 && outcome !== 'makeup' && (
            <div className="mt-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={override}
                  onChange={(e) => {
                    setOverride(e.target.checked)
                    if (e.target.checked && outcome !== 'refund' && outcome !== 'credit') setOutcome('credit')
                    if (!e.target.checked && quote && outcome && !quote.options.includes(outcome)) setOutcome(quote.options[0])
                  }}
                />{' '}
                Override the amount (goodwill)
              </label>
              {override && (
                <label className="mt-2 block max-w-xs text-sm">
                  Amount (AUD, up to {money(Math.max(quote.value, quote.maxReturn))})
                  <input name="amount" type="number" min={0} step="0.01" max={Math.max(quote.value, quote.maxReturn)} defaultValue={quote.value} className={`${inputCls} mt-1 rounded-none`} />
                </label>
              )}
              {outcome === 'refund' && <p className="mt-2 text-xs text-muted">Anything above what can go back to the card is given as account credit.</p>}
            </div>
          )}
        </div>
      )}

      <label className="block text-sm">
        Reason (kept on the booking{by === 'coach' ? '' : ', e.g. “Family away on holiday”'})
        <textarea name="reason" required rows={2} className={`${inputCls} mt-1 rounded-none`} />
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify" defaultChecked /> Email the family and coach</label>

      {state.error && <p role="alert" className="border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{state.error}</p>}
      {state.done && (
        <div role="status" className="border border-white/40 px-4 py-3 text-sm">
          {state.done}
          {state.warnings?.map((w) => <p key={w} className="mt-1 text-amber-300">{w}</p>)}
        </div>
      )}
      <button disabled={pending || !quote || !quote.sessionIds.length || !outcome} className="bg-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-black disabled:opacity-40">
        {pending ? 'Working…' : 'Cancel and apply'}
      </button>
    </form>
  )
}

export function RetryRefund({ bookingId, refundKey }: { bookingId: number; refundKey: string }) {
  const [state, action, pending] = useActionState<StaffActionState, FormData>(submitRetryRefund, {})
  return (
    <form action={action} className="inline">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="key" value={refundKey} />
      <button disabled={pending} className="border border-white/60 px-3 py-1 text-xs font-semibold uppercase">{pending ? 'Retrying…' : 'Retry refund'}</button>
      {state.error && <span className="ml-2 text-xs text-red-300">{state.error}</span>}
      {state.done && <span className="ml-2 text-xs">{state.done}</span>}
    </form>
  )
}

export function Goodwill({ bookingId, disabled }: { bookingId: number; disabled?: boolean }) {
  const [state, action, pending] = useActionState<StaffActionState, FormData>(submitGoodwill, {})
  if (disabled) return <p className="text-sm text-muted">This booking has no family account yet, so credit can’t be given.</p>
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
      <input type="hidden" name="bookingId" value={bookingId} />
      <label className="text-sm">Amount<input name="amount" type="number" min={1} max={500} step="0.01" required className={`${inputCls} mt-1 rounded-none`} /></label>
      <label className="text-sm">Reason<input name="reason" required className={`${inputCls} mt-1 rounded-none`} /></label>
      <button disabled={pending} className="border border-line px-4 py-2.5 text-sm font-semibold uppercase">{pending ? 'Adding…' : 'Add credit'}</button>
      {state.error && <p role="alert" className="text-sm text-red-300 sm:col-span-3">{state.error}</p>}
      {state.done && <p role="status" className="text-sm sm:col-span-3">{state.done}</p>}
    </form>
  )
}
