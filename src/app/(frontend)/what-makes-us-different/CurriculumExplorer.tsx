'use client'

import { useState } from 'react'

export type ExplorerLevel = { key: string; name: string; phase: string; standard: string; descriptors: { code: string; text: string }[] }
export type Pillar = { key: string; name: string; line?: string }

/**
 * A taste of the curriculum: the Attacking pillar, clickable through every age level (straight from the
 * curriculum in the admin, so it stays current). The other five pillars are listed but stay closed —
 * the full curriculum is for our coaches and players.
 */
export function CurriculumExplorer({ levels, pillars, open = 'ATT' }: { levels: ExplorerLevel[]; pillars: Pillar[]; open?: string }) {
  const [active, setActive] = useState(levels.find((l) => l.key === '8')?.key ?? levels[0]?.key)
  const level = levels.find((l) => l.key === active)
  if (!level) return null
  const shown = pillars.find((p) => p.key === open)
  const closed = pillars.filter((p) => p.key !== open)
  return (
    <div className="overflow-hidden rounded-2xl bg-[#0f2a55] text-white shadow-xl">
      <div className="border-b border-white/10 px-5 pt-6 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Foundation Football Curriculum</p>
        <div role="tablist" aria-label="Curriculum level" className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-5">
          {levels.map((l) => (
            <button
              key={l.key}
              type="button"
              role="tab"
              id={`cur-tab-${l.key}`}
              aria-selected={l.key === active}
              aria-controls="cur-panel"
              onClick={() => setActive(l.key)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${l.key === active ? 'border-accent bg-accent text-accent-ink' : 'border-white/25 text-white hover:border-white'}`}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>
      <div id="cur-panel" role="tabpanel" aria-labelledby={`cur-tab-${level.key}`} className="px-5 py-6 sm:px-8">
        <p className="font-[family-name:var(--font-barlow)] text-3xl font-bold uppercase">{level.name}</p>
        <p className="text-sm text-white/70">Phase: {level.phase}</p>

        {shown && (
          <div className="mt-5 rounded-xl border border-white/15 bg-white/5 p-5">
            <p className="flex items-baseline gap-2">
              <span className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">{shown.name}</span>
              <span className="text-sm text-white/60">({shown.key})</span>
              <span aria-hidden className="ml-auto text-accent">▾</span>
            </p>
            {level.standard && (
              <p className="mt-3 rounded-lg bg-black/25 p-4 text-sm leading-relaxed">
                <strong className="text-accent">Achievement standard:</strong> {level.standard}
              </p>
            )}
            <ul className="mt-4 space-y-2.5">
              {level.descriptors.map((d) => (
                <li key={d.code} className="grid gap-1 text-sm sm:grid-cols-[7.5rem_1fr] sm:gap-4">
                  <span className="font-mono text-xs leading-5 text-white/55">{d.code}</span>
                  <span>{d.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-white/60">The other five pillars</p>
        <ul className="mt-2 divide-y divide-white/10 rounded-xl border border-white/15">
          {closed.map((p) => (
            <li key={p.key} className="flex cursor-not-allowed items-center gap-3 px-5 py-4" aria-disabled="true" title="The full curriculum is shared with our players and coaches">
              <span className="min-w-0 flex-1">
                <span className="font-[family-name:var(--font-barlow)] text-xl font-bold uppercase">{p.name}</span>
                <span className="ml-2 text-sm text-white/50">({p.key})</span>
                {p.line && <span className="block text-sm text-white/60">{p.line}</span>}
              </span>
              <span aria-hidden className="text-xl text-white/50">▸</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-white/55">A preview — the full curriculum, every pillar at every age, is what our coaches plan from and what player reports are written against.</p>
      </div>
    </div>
  )
}
