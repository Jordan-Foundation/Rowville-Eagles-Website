'use client'

import { useActionState, useMemo, useState } from 'react'
import { saveAvailability, type AvailabilityState } from './actions'

type Props = { termId: number; weekdays: readonly string[]; times: string[]; allowed: Record<string, string[]>; initial: string[]; submitted: boolean; locked: boolean; lastTerm?: { name: string; slots: string[] } | null; noun?: 'term' | 'holidays' }

const label12 = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`
}

export function AvailabilityGrid({ termId, weekdays, times, allowed, initial, submitted, locked, lastTerm, noun = 'term' }: Props) {
  const [day, setDay] = useState(weekdays.find((d) => (allowed[d] ?? []).length) ?? weekdays[0])
  const [picked, setPicked] = useState<Set<string>>(() => new Set(initial))
  const [state, action, pending] = useActionState<AvailabilityState, FormData>(saveAvailability, {})
  const dirty = useMemo(() => picked.size !== initial.length || [...picked].some((k) => !initial.includes(k)), [picked, initial])
  const toggle = (k: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  const toggleDay = (day: string) =>
    setPicked((prev) => {
      const keys = (allowed[day] ?? []).map((t) => `${day} ${t}`)
      const allOn = keys.every((k) => prev.has(k))
      const next = new Set(prev)
      keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)))
      return next
    })

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="termId" value={termId} />
      <input type="hidden" name="slots" value={JSON.stringify([...picked])} />

      {lastTerm && lastTerm.slots.length > 0 && !locked && (
        <div className="flex flex-wrap items-center gap-3 border border-line p-4 text-sm">
          <p className="flex-1">Same as last {noun === 'term' ? 'term' : 'holidays'}? {lastTerm.name}: {lastTerm.slots.length} weekly slot{lastTerm.slots.length === 1 ? '' : 's'}.</p>
          <button type="button" onClick={() => setPicked(new Set(lastTerm.slots))} className="min-h-10 border border-white/40 px-4 text-xs font-semibold uppercase tracking-[0.15em] hover:bg-white hover:text-black">{noun === 'term' ? 'Copy last term’s times' : 'Copy last holidays’ times'}</button>
        </div>
      )}

      {/* Phones: one day at a time */}
      <div className="md:hidden">
        <div className="-mx-1 flex gap-1 overflow-x-auto pb-2" role="tablist" aria-label="Day">
          {weekdays.map((d) => {
            const n = (allowed[d] ?? []).filter((t) => picked.has(`${d} ${t}`)).length
            return (
              <button key={d} type="button" role="tab" aria-selected={day === d} onClick={() => setDay(d)} disabled={!(allowed[d] ?? []).length} className={`min-h-11 min-w-14 shrink-0 border px-2 text-xs font-semibold uppercase disabled:opacity-30 ${day === d ? 'border-white bg-white text-black' : 'border-line text-muted'}`}>
                {d.slice(0, 3)}{n > 0 && <span className="block text-[10px] normal-case">{n} free</span>}
              </button>
            )
          })}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="font-display text-xl font-semibold uppercase">{day}</p>
          <button type="button" disabled={locked} onClick={() => toggleDay(day)} className="text-sm font-semibold underline">{(allowed[day] ?? []).every((t) => picked.has(`${day} ${t}`)) ? 'Clear day' : 'All day'}</button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(allowed[day] ?? []).map((t) => {
            const k = `${day} ${t}`
            const on = picked.has(k)
            return (
              <button key={k} type="button" disabled={locked} aria-pressed={on} aria-label={`${day} ${label12(t)}`} onClick={() => toggle(k)} className={`min-h-12 border text-sm font-semibold ${on ? 'border-white bg-white text-black' : 'border-line bg-surface-2 text-muted'}`}>
                {label12(t)}{on ? ' · Free' : ''}
              </button>
            )
          })}
        </div>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="w-20" />
              {weekdays.map((d) => (
                <th key={d} className="pb-2 font-semibold">
                  <button type="button" disabled={locked} onClick={() => toggleDay(d)} className="w-full py-1 uppercase tracking-wider text-muted hover:text-ink disabled:hover:text-muted" title={`Toggle all of ${d}`}>
                    <span className="sm:hidden">{d.slice(0, 2)}</span>
                    <span className="hidden sm:inline">{d.slice(0, 3)}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {times.map((t) => (
              <tr key={t}>
                <th scope="row" className="pr-2 text-right font-medium text-muted">{label12(t)}</th>
                {weekdays.map((d) => {
                  const k = `${d} ${t}`
                  const on = picked.has(k)
                  if (!allowed[d]?.includes(t)) return <td key={k} aria-hidden className="h-11" />
                  return (
                    <td key={k}>
                      <button
                        type="button"
                        disabled={locked}
                        aria-pressed={on}
                        aria-label={`${d} ${label12(t)}`}
                        onClick={() => toggle(k)}
                        className={`h-11 w-full border text-xs font-semibold uppercase tracking-wider transition ${on ? 'border-white bg-white text-black' : 'border-line bg-surface-2 text-muted hover:border-white/40'} disabled:cursor-not-allowed`}
                      >
                        {on ? 'Free' : ''}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending || locked || (!dirty && submitted)} className="bg-white px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] text-black transition hover:bg-white/85 disabled:opacity-40">
          {pending ? 'Saving…' : submitted ? 'Save changes' : 'Submit availability'}
        </button>
        <p className="text-sm text-muted">{picked.size} weekly slot{picked.size === 1 ? '' : 's'} selected · each runs every week of the {noun}</p>
      </div>
      {state.saved && !pending && (
        <p role="status" className="border border-white/30 px-4 py-3 text-sm">
          {state.first ? `Availability submitted — thanks! You won’t get any more reminders for this ${noun === 'term' ? 'term' : 'timeframe'}.` : 'Changes saved.'}
        </p>
      )}
      {state.error && <p role="alert" className="border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{state.error}</p>}
    </form>
  )
}
