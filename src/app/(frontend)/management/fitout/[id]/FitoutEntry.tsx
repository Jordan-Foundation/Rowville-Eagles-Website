'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { loadSizes, saveSizes } from '../actions'

type Player = { id: number; name: string; number: number | null; birthYear: number | null; programs: string[]; team: string | null }
type Item = { id: number; name: string; sizes: string[] }

/** Tablet-friendly: search → pick a player → sizes (pre-filled) → Save → back to search. */
export function FitoutEntry({ sessionId, players, items, done }: { sessionId: number; players: Player[]; items: Item[]; done: number[] }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Player | null>(null)
  const [sizes, setSizes] = useState<Record<number, string>>({})
  const [notes, setNotes] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const searchRef = useRef<HTMLInputElement>(null)
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (t.length < 2) return []
    return players.filter((p) => p.name.toLowerCase().includes(t) || String(p.number ?? '') === t).slice(0, 12)
  }, [q, players])
  const choose = (p: Player) => start(async () => {
    const r = await loadSizes(sessionId, p.id)
    setSel(p); setSizes(r.sizes as Record<number, string>); setNotes(r.notes); setMsg(null)
    setHint(r.existing ? 'Already fitted this session — check and save any changes.' : r.previous ? 'Filled in from their last fitout — confirm or change.' : null)
  })
  const save = () => sel && start(async () => {
    const r = await saveSizes(sessionId, sel.id, sizes, notes)
    if ('error' in r && r.error) { setMsg(r.error); return }
    setMsg(`Saved ${sel.name}.`); setSel(null); setQ(''); setHint(null)
    router.refresh()
    setTimeout(() => searchRef.current?.focus(), 50)
  })
  const label = (p: Player) => [p.number ? `#${p.number}` : 'No number', p.birthYear ? `born ${p.birthYear}` : null, p.team ?? p.programs.map((x) => (x === 'rfa' ? 'RFA' : 'Rowville')).join(' + ')].filter(Boolean).join(' · ')
  return (
    <div className="space-y-4">
      {!sel ? (
        <div>
          <label className="grid gap-1 text-sm font-semibold">Find a player
            <input ref={searchRef} autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a name (or number)" className="min-h-12 border border-line bg-surface px-3 text-lg" aria-label="Find a player" />
          </label>
          {msg && <p role="status" className="mt-2 text-sm text-emerald-300">{msg}</p>}
          <ul className="mt-2 divide-y divide-line border border-line empty:hidden" aria-label="Matches">
            {matches.map((p) => (
              <li key={p.id}><button type="button" onClick={() => choose(p)} className="flex w-full flex-wrap justify-between gap-2 p-3 text-left hover:bg-white/5" data-match={p.name}><span className="font-semibold">{p.name}{done.includes(p.id) ? ' ✓' : ''}</span><span className="text-sm text-muted">{label(p)}</span></button></li>
            ))}
          </ul>
          {q.trim().length >= 2 && !matches.length && <p className="mt-2 text-sm text-muted">No active RFA or Rowville player by that name.</p>}
        </div>
      ) : (
        <div className="panel space-y-4 border border-line p-5" aria-label="Sizes">
          <div>
            <p className="text-xl font-semibold" data-fit-player>{sel.name}</p>
            <p className="text-sm text-muted">{label(sel)}</p>
            {!sel.number && <p className="mt-1 text-sm font-semibold text-amber-300" data-no-number>No number — pick before ordering</p>}
            {hint && <p className="mt-1 text-sm text-muted" data-prefill>{hint}</p>}
          </div>
          {items.map((it) => (
            <label key={it.id} className="grid gap-1 text-sm font-semibold">{it.name}
              <select value={sizes[it.id] ?? ''} onChange={(e) => setSizes({ ...sizes, [it.id]: e.target.value })} className="min-h-12 border border-line bg-surface px-2 text-base" aria-label={`${it.name} size`}>
                <option value="">—</option>
                {it.sizes.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          ))}
          <label className="grid gap-1 text-sm font-semibold">Notes <span className="font-normal text-muted">(optional)</span><input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} placeholder="e.g. between sizes" className="min-h-12 border border-line bg-surface px-3" /></label>
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={pending} className="min-h-12 flex-1 bg-white px-5 text-xs font-semibold uppercase tracking-[0.14em] text-black disabled:opacity-60">{pending ? 'Saving…' : 'Save & next'}</button>
            <button type="button" onClick={() => { setSel(null); setHint(null) }} className="min-h-12 border border-line px-4 text-sm">Cancel</button>
          </div>
          {msg && <p role="alert" className="text-sm text-red-300">{msg}</p>}
        </div>
      )}
    </div>
  )
}
