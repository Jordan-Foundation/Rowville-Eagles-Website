'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { confirmAction, holdAction, type PickState } from './actions'

export function NumberPicker({ kidId, name, numbers, taken, initial, previous }: { kidId: number; name: string; numbers: number[]; taken: number[]; initial: number | null; previous: number | null }) {
  const [selected, setSelected] = useState<number | null>(initial ?? previous)
  const [state, setState] = useState<PickState>(initial ? { held: initial } : {})
  const [gone, setGone] = useState<number[]>(taken)
  const [pending, start] = useTransition()
  if (state.done) {
    return (
      <div className="text-center" role="status" data-number-done>
        <p className="text-sm uppercase tracking-[0.2em] text-muted">{name}’s number</p>
        <p className="mt-2 font-[family-name:var(--font-barlow)] text-8xl font-extrabold">{state.done}</p>
        <p className="mt-3 text-muted">It’s theirs for the Academy and Rowville Eagles.</p>
        <Link href="/account" className="mt-6 inline-block rounded-full bg-brand px-6 py-3 font-semibold text-white">Done</Link>
      </div>
    )
  }
  const pick = (n: number) => {
    setSelected(n)
    start(async () => {
      const r = await holdAction(kidId, n)
      if (r.error) { setGone((g) => [...g, n]); setSelected(null) }
      setState(r)
    })
  }
  const confirm = () => selected && start(async () => {
    const r = await confirmAction(kidId, selected)
    if (r.error && /taken/i.test(r.error)) { setGone((g) => [...g, selected]); setSelected(null) }
    setState(r)
  })
  return (
    <div className="space-y-5">
      {previous && selected === previous && <p className="text-sm">{name} wore <strong>{previous}</strong> before and it’s still free — confirm to keep it, or choose another.</p>}
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-10" role="group" aria-label="Numbers">
        {numbers.map((n) => {
          const isTaken = gone.includes(n)
          const on = selected === n
          return (
            <button key={n} type="button" disabled={isTaken || pending} onClick={() => pick(n)} aria-pressed={on} aria-label={isTaken ? `${n} taken` : `${n}`} data-num={n}
              className={`aspect-square rounded-lg border text-lg font-bold ${isTaken ? 'cursor-not-allowed border-line text-muted/40 line-through' : on ? 'border-brand bg-brand text-white' : 'border-line hover:border-brand'}`}>
              {n}
            </button>
          )
        })}
      </div>
      {state.error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700">{state.error}</p>}
      {state.held && selected === state.held && <p className="text-sm text-muted" data-held>{state.held} is held for you for 10 minutes.</p>}
      <button type="button" onClick={confirm} disabled={!selected || pending} className="w-full rounded-full bg-accent px-6 py-4 font-semibold text-accent-ink disabled:opacity-50">{pending ? 'Saving…' : selected ? `Confirm number ${selected}` : 'Tap a number'}</button>
      <p className="text-xs text-muted">Greyed-out numbers are taken. Number 1 is kept for goalkeeper tops.</p>
    </div>
  )
}
