'use client'

import { useState, useTransition } from 'react'
import { Grip, usePointerDrag } from '@/components/dnd/usePointerDrag'
import { moveAgeAction } from '../v2-actions'

export type MacroCard = { id: number; name: string; born: number; playing: number; team: string | null }
type Column = { year: number; label: string; hint: string }

/** Every selected player by age group. Drag (or "Move to…") to play someone up or down; it clears their team. */
export function MacroBoard({ cards: initial, columns }: { cards: MacroCard[]; columns: Column[] }) {
  const [cards, setCards] = useState(initial)
  const [status, setStatus] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null)
  const [search, setSearch] = useState('')
  const [, start] = useTransition()
  const move = (id: number, to: number) => {
    const card = cards.find((c) => c.id === id)
    if (!card || card.playing === to) return
    const before = cards
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, playing: to, team: null } : c)))
    setStatus({ tone: 'ok', text: 'Saving…' })
    start(async () => {
      const r = await moveAgeAction(id, to)
      if (r.error) {
        setCards(before)
        setStatus({ tone: 'error', text: r.error })
      } else setStatus(r.warning ? { tone: 'warn', text: `Saved. ${r.warning}` } : { tone: 'ok', text: `Saved — ${card.name} is now in the ${columns.find((c) => c.year === to)?.label ?? to}.` })
    })
  }
  const { drag, dragProps, Ghost } = usePointerDrag((id, target) => move(Number(id), Number(target.replace('age:', ''))))
  const q = search.trim().toLowerCase()
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">Find a player <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name" className="min-h-10 border border-line bg-surface px-2" /></label>
        <p role="status" aria-live="polite" data-save-status={status?.tone} className={`text-sm ${status?.tone === 'error' ? 'text-red-300' : status?.tone === 'warn' ? 'text-amber-300' : 'text-emerald-300'}`}>{status?.text}</p>
      </div>
      <p className="text-xs text-muted"><span className="mr-1 inline-block h-3 w-1 bg-amber-400 align-middle" /> playing up or down (not their year of birth)</p>
      <div className="flex gap-3 overflow-x-auto pb-4" data-macro>
        {columns.map((col) => {
          const list = cards.filter((c) => c.playing === col.year).sort((a, b) => a.name.localeCompare(b.name))
          return (
            <section key={col.year} data-drop={`age:${col.year}`} data-age={col.year} aria-label={col.label} className={`w-44 shrink-0 border p-2 transition ${drag?.over === `age:${col.year}` ? 'border-white bg-white/5' : 'border-line'}`}>
              <h3 className="mb-2 flex items-baseline justify-between gap-2 px-1">
                <span className="font-display text-lg font-semibold uppercase">{col.label}</span>
                <span className="text-xs text-muted" data-count={list.length}>{list.length} · {col.hint}</span>
              </h3>
              <ul className="space-y-1">
                {list.map((c) => {
                  const off = c.born !== c.playing
                  const hit = q && c.name.toLowerCase().includes(q)
                  return (
                    <li key={c.id} {...dragProps(String(c.id), c.name)} data-card={c.name} data-off={off ? 'yes' : undefined} className={`flex cursor-grab items-center gap-1 border-l-4 bg-white/5 py-1 pr-1 text-xs ${off ? 'border-amber-400' : 'border-transparent'} ${hit ? 'ring-2 ring-sky-400' : ''} ${drag?.id === String(c.id) ? 'opacity-40' : ''}`} title={c.team ? `In ${c.team}` : undefined}>
                      <Grip />
                      <span className="min-w-0 flex-1 truncate"><span className="font-semibold">{c.name}</span> <span className="text-muted">{c.born}</span></span>
                      <select aria-label={`Move ${c.name} to age group`} value="" onChange={(e) => { const v = Number(e.currentTarget.value); if (v) move(c.id, v) }} className="w-6 shrink-0 appearance-none border border-line bg-surface text-center text-xs" title="Move to…">
                        <option value="">⋯</option>
                        {columns.filter((x) => x.year !== col.year).map((x) => <option key={x.year} value={x.year}>Move to {x.label}</option>)}
                      </select>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
      <Ghost />
    </div>
  )
}
