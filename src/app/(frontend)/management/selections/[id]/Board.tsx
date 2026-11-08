'use client'

import { useActionState, useState } from 'react'
import { boardAction, type BoardState } from '../actions'

export type Row = {
  id: number
  name: string
  placement: string
  moved: boolean
  status: string
  queued: string | null
  squad: string | null
  trial: string | null
  flags: string[]
  contact: string
  notes: string | null
  lastMove: string | null
  payment: { due: string; overdue: boolean; reminders: string } | null
  paid: string | null
}

type Props = {
  roundId: number
  kind: 'tournament' | 'rowville'
  groups: { year: number; label: string; hint: string; rows: Row[] }[]
  squads: { id: number; name: string }[]
  years: { year: number; label: string }[]
}

const field = 'rounded-lg border border-line bg-surface px-3 py-2 text-sm'

export function Board({ roundId, kind, groups, squads, years }: Props) {
  const [picked, setPicked] = useState<number[]>([])
  const [op, setOp] = useState<'squad' | 'move' | 'pick' | 'unsuccessful' | 'clear' | 'release' | 'remind'>('squad')
  // Controlled, so a "please confirm" round-trip keeps what staff typed (React resets uncontrolled fields after an action)
  const [moveTo, setMoveTo] = useState('')
  const [reason, setReason] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [state, action, pending] = useActionState<BoardState, FormData>(async (prev, fd) => {
    const r = await boardAction(prev, fd)
    if (!r.error) {
      setPicked([])
      setReason('')
      setMoveTo('')
      setConfirm(false)
    }
    return r
  }, {})
  const toggle = (id: number) => setPicked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
  const all = (rows: Row[]) => {
    const ids = rows.map((r) => r.id)
    const every = ids.every((id) => picked.includes(id))
    setPicked((c) => (every ? c.filter((id) => !ids.includes(id)) : [...new Set([...c, ...ids])]))
  }

  return (
    <div>
      <form action={action} className="sticky top-16 z-10 mb-6 flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <input type="hidden" name="roundId" value={roundId} />
        <input type="hidden" name="ids" value={picked.join(',')} />
        <input type="hidden" name="op" value={op} />
        <p className="mr-2 self-center text-sm font-semibold">{picked.length} ticked</p>
        <select value={op} onChange={(e) => setOp(e.target.value as typeof op)} className={field} aria-label="Action">
          <option value="squad">Put in squad…</option>
          <option value="move">Move age group…</option>
          <option value="pick">{kind === 'tournament' ? 'Select' : 'Successful'}</option>
          <option value="unsuccessful">Unsuccessful</option>
          <option value="clear">Clear outcome</option>
          <option value="remind">Send payment reminder now</option>
          <option value="release">Release spot (unpaid)</option>
        </select>
        {op === 'squad' && (
          <select name="squad" className={field} aria-label="Squad" defaultValue="">
            <option value="">— no squad —</option>
            {squads.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {op === 'move' && (
          <>
            <select name="to" className={field} aria-label="Move to" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              <option value="">Move to…</option>
              {years.map((y) => <option key={y.year} value={y.year}>{y.label}</option>)}
            </select>
            <input name="reason" required placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} className={`${field} min-w-56 flex-1`} />
            {state.needsConfirm && (
              <label className="flex items-center gap-2 text-sm text-amber-700"><input type="checkbox" name="confirm" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> Confirm moving down 2 groups (only if they can’t take part in their own age group)</label>
            )}
          </>
        )}
        {op === 'release' && (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="email" value="on" defaultChecked /> Email the family</label>
        )}
        {op === 'unsuccessful' && (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="email" value="on" defaultChecked /> Email the family</label>
        )}
        <button disabled={pending || !picked.length} className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">{pending ? 'Working…' : 'Apply'}</button>
        {state.error && <p role="alert" className="basis-full text-sm text-red-700">{state.error}</p>}
        {state.done && <p role="status" className="basis-full text-sm text-emerald-700">{state.done}</p>}
      </form>

      {groups.length === 0 && <p className="rounded-2xl border border-line p-6 text-muted">Nobody here yet.</p>}
      <div className="space-y-8">
        {groups.map((g) => (
          <section key={g.year} aria-labelledby={`g${g.year}`}>
            <div className="flex items-center justify-between gap-3">
              <h2 id={`g${g.year}`} className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">
                {g.label} <span className="text-base font-semibold normal-case text-muted">{g.hint} · {g.rows.length}</span>
              </h2>
              <button type="button" onClick={() => all(g.rows)} className="text-sm font-semibold text-brand underline">Tick all</button>
            </div>
            <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
              {g.rows.map((r) => (
                <li key={r.id}>
                  <label className={`grid cursor-pointer gap-1 p-4 sm:grid-cols-[1.5rem_1fr_auto] sm:items-start sm:gap-4 ${picked.includes(r.id) ? 'bg-brand/5' : ''}`}>
                    <input type="checkbox" checked={picked.includes(r.id)} onChange={() => toggle(r.id)} className="mt-1" aria-label={`Tick ${r.name}`} />
                    <span>
                      <span className="font-semibold">{r.name}</span>
                      {r.flags.includes('outside-miniroos') && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Outside MiniRoos</span>}
                      <span className={`block text-sm ${r.moved ? 'font-medium text-amber-800' : 'text-muted'}`}>{r.placement}</span>
                      {r.lastMove && <span className="block text-xs text-muted">Moved: {r.lastMove}</span>}
                      <span className="block text-xs text-muted">{[r.trial, r.contact, r.notes].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="flex flex-wrap gap-1.5 sm:justify-end">
                      {r.squad && <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-white">{r.squad}</span>}
                      <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold">{r.status}</span>
                      {r.queued && <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-ink">To send: {r.queued}</span>}
                      {r.payment && (
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${r.payment.overdue ? 'bg-red-600 text-white' : 'bg-amber-100 text-amber-800'}`}>
                          {r.payment.overdue ? 'Overdue — was due' : 'Pay by'} {r.payment.due}{r.payment.reminders ? ` · reminded ${r.payment.reminders}` : ''}
                        </span>
                      )}
                      {r.paid && <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">Paid {r.paid}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
