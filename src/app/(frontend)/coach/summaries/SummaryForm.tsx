'use client'

import { useActionState, useState } from 'react'
import { saveSummaryAction, type SummaryState } from './actions'

const area = 'min-h-[4.5rem] w-full border border-line bg-surface p-2 text-sm'

export function SummaryForm(props: { sessionId: number; focus: readonly string[]; players: { sessionId: number; name: string }[]; group: boolean; done: number; total: number; skip: string; last: boolean }) {
  const [state, action, pending] = useActionState<SummaryState, FormData>(saveSummaryAction, {})
  const [picked, setPicked] = useState<string[]>([])
  const [effort, setEffort] = useState(0)
  const toggle = (f: string) => setPicked((p) => (p.includes(f) ? p.filter((x) => x !== f) : p.length >= 3 ? p : [...p, f]))
  return (
    <form action={action} className="space-y-5" aria-label="Session summary">
      <input type="hidden" name="session" value={props.sessionId} />
      <input type="hidden" name="done" value={props.done} />
      <input type="hidden" name="total" value={props.total} />
      <input type="hidden" name="skip" value={props.skip} />
      <fieldset>
        <legend className="text-sm font-semibold">Worked on <span className="font-normal text-muted">(tap up to 3)</span></legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {props.focus.map((f) => (
            <label key={f} className={`cursor-pointer border px-3 py-2 text-sm ${picked.includes(f) ? 'border-white bg-white text-black' : 'border-line'}`}>
              <input type="checkbox" name="workedOn" value={f} checked={picked.includes(f)} onChange={() => toggle(f)} className="sr-only" />{f}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-1 text-sm font-semibold">What went well<textarea name="wentWell" maxLength={600} className={area} placeholder="e.g. Much cleaner first touch on the half-turn" /></label>
      <label className="grid gap-1 text-sm font-semibold">Next steps<textarea name="nextSteps" maxLength={600} className={area} placeholder="e.g. Scan before receiving; use the left foot more" /></label>
      <label className="grid gap-1 text-sm font-semibold">Practise at home <span className="font-normal text-muted">(optional)</span><textarea name="homework" maxLength={600} className={area} placeholder="e.g. 5 minutes of wall passes, left foot only" /></label>
      {props.group && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">A line for each player <span className="font-normal text-muted">(optional — only their family sees it)</span></legend>
          {props.players.map((pl) => <label key={pl.sessionId} className="grid gap-1 text-sm">{pl.name}<input name={`player-${pl.sessionId}`} maxLength={400} className="min-h-10 border border-line bg-surface px-2 text-sm" /></label>)}
        </fieldset>
      )}
      <fieldset>
        <legend className="text-sm font-semibold">Effort <span className="font-normal text-muted">(optional)</span></legend>
        <div className="mt-1 flex gap-1" role="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer text-2xl leading-none" aria-label={`${n} of 5`}>
              <input type="radio" name="effort" value={n} checked={effort === n} onChange={() => setEffort(n)} className="sr-only" />
              <span className={n <= effort ? 'text-amber-300' : 'text-muted'}>★</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-1 border border-amber-400/40 bg-amber-400/5 p-3 text-sm font-semibold">🔒 Coach &amp; admin notes <span className="font-normal text-muted">Never shown to the family — anything the next coach or Management should know (behaviour, injury, what to watch).</span><textarea name="privateNotes" maxLength={1500} className={area} /></label>
      {state.error && <p role="alert" className="border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{state.error}</p>}
      <button disabled={pending} className="min-h-12 w-full bg-white px-5 text-xs font-semibold uppercase tracking-[0.14em] text-black disabled:opacity-60">{pending ? 'Saving…' : props.last ? 'Save & finish' : 'Save & next'}</button>
      <p className="text-xs text-muted">Saving emails the family the summary straight away (not the coach &amp; admin notes).</p>
    </form>
  )
}
