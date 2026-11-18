'use client'

import { useState, useTransition } from 'react'
import { Grip, usePointerDrag } from '@/components/dnd/usePointerDrag'
import { POSITION_GROUPS, type PositionGroup } from '@/selections/flow'
import { placeAction } from '../v2-actions'

export type MicroCard = { id: number; name: string; born: number; playing: number; squad: number | null; position: PositionGroup | null; positionText: string | null; tags: string[]; np: boolean; offerSent: boolean }
export type MicroTeam = { id: number; name: string; coach: string | null; finalised: boolean; counts: { players: number } }

const POS_LABEL: Record<string, string> = { gk: 'GK', def: 'DEF', mid: 'MID', fwd: 'FWD' }

/** One age group: Unassigned + a column per team. Drag between teams and position groups, or use "Move to…". */
export function MicroBoard({ cards: initial, teams }: { cards: MicroCard[]; teams: MicroTeam[]; unassignedCount: number }) {
  const [cards, setCards] = useState(initial)
  const [depth, setDepth] = useState(true)
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [, start] = useTransition()
  const locked = (squad: number | null) => Boolean(squad && teams.find((t) => t.id === squad)?.finalised)

  const place = (id: number, squad: number | null, position: PositionGroup | null | 'keep') => {
    const card = cards.find((c) => c.id === id)
    if (!card) return
    const pos = position === 'keep' ? card.position : position
    if (card.squad === squad && card.position === pos) return
    if (locked(card.squad) && card.squad !== squad) return setStatus({ tone: 'error', text: `${teams.find((t) => t.id === card.squad)?.name} is finalised — unlock it first.` })
    if (locked(squad) && card.squad !== squad) return setStatus({ tone: 'error', text: `${teams.find((t) => t.id === squad)?.name} is finalised — unlock it first.` })
    const before = cards
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, squad, position: pos } : c)))
    setStatus({ tone: 'ok', text: 'Saving…' })
    start(async () => {
      const r = await placeAction(id, squad, squad ? pos : card.position)
      if (r.error) {
        setCards(before)
        setStatus({ tone: 'error', text: r.error })
      } else setStatus({ tone: 'ok', text: 'Saved' })
    })
  }
  const { drag, dragProps, Ghost } = usePointerDrag((id, target) => {
    const [, team, pos] = target.split(':')
    place(Number(id), Number(team) || null, pos === 'keep' ? 'keep' : pos === 'none' ? null : (pos as PositionGroup))
  })

  const zone = (key: string, extra = '') => ({ 'data-drop': key, className: `${extra} transition ${drag?.over === key ? 'bg-white/10 outline outline-1 outline-white' : ''}` })

  const Card = ({ c }: { c: MicroCard }) => {
    const lock = locked(c.squad)
    return (
      <li {...(lock ? {} : dragProps(String(c.id), c.name))} data-card={c.name} data-np={c.np ? 'yes' : undefined} className={`flex items-start gap-1 border border-line bg-surface p-2 text-sm ${lock ? '' : 'cursor-grab'} ${drag?.id === String(c.id) ? 'opacity-40' : ''}`}>
        {!lock && <Grip />}
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{c.name}</span>
          <span className="block text-xs text-muted"><span className={c.born !== c.playing ? 'text-amber-300' : ''}>{c.born}{c.born !== c.playing ? (c.born > c.playing ? ' · playing up' : ' · playing down') : ''}</span>{c.positionText ? ` · ${c.positionText}` : c.position ? ` · ${POS_LABEL[c.position]}` : ''}</span>
          <span className="mt-1 flex flex-wrap gap-1">
            {c.tags.map((t) => <span key={t} className="border border-line px-1.5 text-[11px]" data-tag={t}>{t}</span>)}
            {c.np && <span className="border border-amber-400/70 px-1.5 text-[11px] font-semibold text-amber-300" title={c.offerSent ? 'Not paid yet' : 'Offer not sent yet'} data-tag="NP">NP</span>}
            {!c.offerSent && <span className="px-1 text-[11px] text-muted">offer not sent</span>}
          </span>
        </span>
        {!lock && (
          <select aria-label={`Move ${c.name} to`} value="" onChange={(e) => { const [t, p] = e.currentTarget.value.split(':'); if (e.currentTarget.value) place(c.id, Number(t) || null, p === 'none' ? null : p === 'keep' ? 'keep' : (p as PositionGroup)) }} className="max-w-[6.5rem] border border-line bg-surface px-1 py-1 text-xs">
            <option value="">Move to…</option>
            <option value="0:keep">Unassigned</option>
            {teams.filter((t) => !t.finalised).flatMap((t) => [
              <option key={`${t.id}`} value={`${t.id}:keep`}>{t.name}</option>,
              ...POSITION_GROUPS.map((g) => <option key={`${t.id}-${g.key}`} value={`${t.id}:${g.key}`}>{t.name} · {g.label}</option>),
            ])}
          </select>
        )}
      </li>
    )
  }

  const unassigned = cards.filter((c) => !c.squad).sort((a, b) => a.name.localeCompare(b.name))
  const count = (list: MicroCard[], tag: string) => list.filter((c) => c.tags.includes(tag)).length
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={depth} onChange={(e) => setDepth(e.target.checked)} /> Group by position (depth chart)</label>
        <p role="status" aria-live="polite" data-save-status={status?.tone} className={`text-sm ${status?.tone === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>{status?.text}</p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4" data-micro>
        <section aria-label="Unassigned" data-team="unassigned" {...zone('team:0:none', 'w-64 shrink-0 border border-dashed border-line p-2')}>
          <h3 className="mb-2 px-1 font-display text-lg font-semibold uppercase">Unassigned <span className="text-xs text-muted" data-count={unassigned.length}>{unassigned.length}</span></h3>
          <ul className="space-y-1.5">{unassigned.map((c) => <Card key={c.id} c={c} />)}</ul>
        </section>
        {teams.map((t) => {
          const list = cards.filter((c) => c.squad === t.id).sort((a, b) => a.name.localeCompare(b.name))
          return (
            <section key={t.id} aria-label={t.name} data-team={t.name} className={`w-64 shrink-0 border p-2 ${t.finalised ? 'border-emerald-400/50' : 'border-line'}`}>
              <h3 className="px-1 font-display text-lg font-semibold uppercase">{t.finalised && <span title="Finalised">🔒 </span>}{t.name}</h3>
              <p className="px-1 text-xs text-muted">{t.coach ? `Coach ${t.coach}` : 'No coach yet'}</p>
              <p className="mb-2 px-1 text-xs" data-counts>
                <strong data-count={list.length}>{list.length}</strong> players · Mon/Wed {count(list, 'Mon/Wed')} · Tue/Thu {count(list, 'Tue/Thu')} · Sat {count(list, 'Sat')} · Sun {count(list, 'Sun')}
              </p>
              {depth ? (
                <div className="space-y-2">
                  {[...POSITION_GROUPS.map((g) => ({ key: g.key as string, label: g.label })), { key: 'none', label: 'Not sorted' }].map((g) => {
                    const inG = list.filter((c) => (c.position ?? 'none') === g.key)
                    if (g.key === 'none' && !inG.length && t.finalised) return null
                    return (
                      <div key={g.key} aria-label={`${t.name} ${g.label}`} {...zone(`team:${t.id}:${g.key}`, `min-h-10 border border-line/60 p-1 ${t.finalised ? 'pointer-events-none' : ''}`)} data-pos={g.key}>
                        <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{g.label} {inG.length ? `· ${inG.length}` : ''}</p>
                        <ul className="space-y-1.5">{inG.map((c) => <Card key={c.id} c={c} />)}</ul>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <ul {...zone(`team:${t.id}:keep`, `min-h-16 space-y-1.5 ${t.finalised ? 'pointer-events-none' : ''}`)}>{list.map((c) => <Card key={c.id} c={c} />)}</ul>
              )}
            </section>
          )
        })}
        {teams.length === 0 && <p className="self-center text-sm text-muted">Add a team below to start placing players.</p>}
      </div>
      <Ghost />
    </div>
  )
}
