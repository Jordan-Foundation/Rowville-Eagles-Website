'use client'

import { useActionState, useMemo, useState } from 'react'
import { saveAvailability, type AvailabilityState } from './actions'

type Props = { termId: number; weekdays: readonly string[]; times: string[]; initial: string[]; submitted: boolean; locked: boolean }

const label12 = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`
}

export function AvailabilityGrid({ termId, weekdays, times, initial, submitted, locked }: Props) {
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
      const keys = times.map((t) => `${day} ${t}`)
      const allOn = keys.every((k) => prev.has(k))
      const next = new Set(prev)
      keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)))
      return next
    })

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="termId" value={termId} />
      <input type="hidden" name="slots" value={JSON.stringify([...picked])} />

      <div className="overflow-x-auto">
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
        <p className="text-sm text-muted">{picked.size} weekly slot{picked.size === 1 ? '' : 's'} selected · each runs every week of the term</p>
      </div>
      {state.saved && !pending && (
        <p role="status" className="border border-white/30 px-4 py-3 text-sm">
          {state.first ? 'Availability submitted — thanks! You won’t get any more reminders for this term.' : 'Changes saved.'}
        </p>
      )}
      {state.error && <p role="alert" className="border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{state.error}</p>}
    </form>
  )
}
