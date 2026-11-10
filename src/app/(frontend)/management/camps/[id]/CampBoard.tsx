'use client'

import { useState, useTransition } from 'react'
import type { CampGroupView } from '@/camps/groups'
import { moveKidAction, resetGroupsAction, unlockKidAction, type CampActionState } from './actions'

/**
 * The camp's age groups. Drag a child onto another group (or use "Move to" on a phone / keyboard);
 * a moved child is locked there so automatic regrouping leaves them alone.
 */
export function CampBoard({ campId, groups, dayNames, totalDays }: { campId: number; groups: CampGroupView[]; dayNames: Record<string, string>; totalDays: number }) {
  const [state, setState] = useState<CampActionState>({})
  const [over, setOver] = useState<number | null>(null)
  const [pending, start] = useTransition()
  const nextGroup = Math.max(0, ...groups.map((g) => g.n)) + 1
  const run = (fn: () => Promise<CampActionState>) => start(async () => setState(await fn()))
  const move = (placementId: number, group: number) => run(() => moveKidAction(campId, placementId, group))
  const dropProps = (n: number) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOver(n) },
    onDragLeave: () => setOver((x) => (x === n ? null : x)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      setOver(null)
      const id = Number(e.dataTransfer.getData('text/plain'))
      if (id) move(id, n)
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Drag a child to another group, or use “Move to”. Children you move stay there (🔒) when new bookings come in.</p>
        <button type="button" disabled={pending} onClick={() => { if (confirm('Unlock everyone and work the groups out again from dates of birth?')) run(() => resetGroupsAction(campId)) }} className="min-h-10 border border-line px-3 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white disabled:opacity-50">
          Reset groups
        </button>
      </div>
      {(state.done || state.error) && (
        <p role={state.error ? 'alert' : 'status'} className={`border p-3 text-sm ${state.error ? 'border-red-400/40 text-red-200' : 'border-emerald-400/40 text-emerald-200'}`}>{state.error ?? state.done}</p>
      )}
      <div className={`grid gap-4 md:grid-cols-2 xl:grid-cols-3 ${pending ? 'opacity-60' : ''}`}>
        {groups.map((g) => (
          <section key={g.n} aria-label={g.label} data-group={g.n} {...dropProps(g.n)} className={`border p-4 transition ${over === g.n ? 'border-white bg-white/5' : 'border-line'}`}>
            <h3 className="font-display text-lg font-semibold uppercase">{g.label}</h3>
            <ul className="mt-3 divide-y divide-line">
              {g.kids.map((k) => (
                <li
                  key={k.placementId}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(k.placementId)); e.dataTransfer.effectAllowed = 'move' }}
                  data-kid={k.name}
                  className="flex cursor-grab flex-wrap items-center justify-between gap-2 py-2 text-sm active:cursor-grabbing"
                >
                  <span className="min-w-0">
                    <span className="font-semibold">{k.name}</span>
                    <span className="text-muted"> · {k.age ?? '?'}</span>
                    {k.locked && <span className="ml-1" title="Placed by hand">🔒</span>}
                    <span className="block text-xs text-muted">
                      {k.days.length === totalDays ? 'Every day' : k.days.map((d) => dayNames[d] ?? d).join(', ')}
                      {k.siblings ? ' · with sibling' : ''}
                      {k.keepWith ? ` · keep with ${k.keepWith}` : ''}
                      {k.medical ? ' · medical' : ''}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {k.locked && <button type="button" disabled={pending} onClick={() => run(() => unlockKidAction(campId, k.placementId))} className="text-xs underline">Unlock</button>}
                    <select
                      aria-label={`Move ${k.name} to`}
                      value=""
                      disabled={pending}
                      onChange={(e) => { const n = Number(e.currentTarget.value); if (n) move(k.placementId, n) }}
                      className="border border-line bg-surface px-2 py-1 text-xs"
                    >
                      <option value="">Move to…</option>
                      {groups.filter((x) => x.n !== g.n).map((x) => <option key={x.n} value={x.n}>Group {x.n}</option>)}
                      <option value={nextGroup}>New group ({nextGroup})</option>
                    </select>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {groups.length > 0 && (
          <section aria-label="New group" {...dropProps(nextGroup)} className={`flex min-h-32 items-center justify-center border-2 border-dashed p-4 text-sm text-muted transition ${over === nextGroup ? 'border-white text-ink' : 'border-line'}`}>
            Drop here to start group {nextGroup}
          </section>
        )}
      </div>
    </div>
  )
}
