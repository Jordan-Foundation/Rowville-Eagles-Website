'use client'

import { useActionState, useMemo, useState } from 'react'
import { groupAction, moveAction, type BoardState } from './actions'

export type BoardRow = {
  id: number
  name: string
  reference: string
  birthYear: number
  playing: number | null
  placement: string
  slotId: number | null
  slotLabel: string
  groupId: string | null
  groupName: string | null
  status: string
  statusLabel: string
  parent: string
  phone: string
  medical: boolean
  moves: { from?: string | null; to?: string | null; reason?: string | null }[]
  coachIds: number[]
}
export type BoardSlot = { id: number; label: string; years: string; groups: { id: string; name: string }[] }

const sel = 'rounded-lg border border-line bg-surface px-2 py-1.5 text-sm'
const btn = 'rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50'

function Result({ s }: { s: BoardState }) {
  return (
    <div className="space-y-1 text-sm">
      {s.error && <p role="alert" className="text-red-700">{s.error}</p>}
      {s.done && <p role="status" className="text-emerald-700">{s.done}</p>}
      {s.needReason?.map((m) => <p key={m} className="text-amber-800">⚠ {m}</p>)}
      {s.warnings?.filter((w) => !s.needReason?.includes(w)).map((m) => <p key={m} className="text-amber-800">⚠ {m}</p>)}
      {s.blocked?.map((m) => <p key={m} className="text-red-700">✕ Not moved — {m}</p>)}
    </div>
  )
}

export function Board({ programId, rows, slots, coaches }: { programId: number; rows: BoardRow[]; slots: BoardSlot[]; coaches: { id: number; name: string }[] }) {
  const [f, setF] = useState({ year: '', slot: '', group: '', coach: '', status: '' })
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [moveState, move, moving] = useActionState<BoardState, FormData>(moveAction, {})
  const [groupState, group, grouping] = useActionState<BoardState, FormData>(groupAction, {})
  const [reason, setReason] = useState('')
  // Controlled: React resets uncontrolled fields after each action, which would lose the choice on the "add a reason" round-trip
  const [target, setTarget] = useState('')
  const [groupPick, setGroupPick] = useState('')

  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!f.year || String(r.playing ?? r.birthYear) === f.year) &&
          (!f.slot || String(r.slotId ?? '') === f.slot) &&
          (!f.group || (f.group === '-' ? !r.groupId : `${r.slotId}:${r.groupId}` === f.group)) &&
          (!f.coach || r.coachIds.includes(Number(f.coach))) &&
          (!f.status || (f.status === 'unpaid' ? r.status !== 'paid' : r.status === f.status)),
      ),
    [rows, f],
  )
  const years = [...new Set(rows.map((r) => r.playing ?? r.birthYear))].sort((a, b) => b - a)
  const byYear = years.map((y) => ({ y, list: shown.filter((r) => (r.playing ?? r.birthYear) === y) })).filter((g) => g.list.length)
  const toggle = (id: number) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAll = (list: BoardRow[], on: boolean) => setPicked((s) => { const n = new Set(s); list.forEach((r) => (on ? n.add(r.id) : n.delete(r.id))); return n })
  const hidden = [...picked].map((id) => <input key={id} type="hidden" name="ids" value={id} />)
  const exportQuery = new URLSearchParams({ program: String(programId), ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) }).toString()

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <select aria-label="Age group" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} className={sel}>
          <option value="">All age groups</option>
          {years.map((y) => <option key={y} value={y}>{y}s</option>)}
        </select>
        <select aria-label="Training time" value={f.slot} onChange={(e) => setF({ ...f, slot: e.target.value, group: '' })} className={sel}>
          <option value="">All training times</option>
          {slots.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select aria-label="Group" value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })} className={sel}>
          <option value="">All groups</option>
          <option value="-">No group</option>
          {slots.filter((s) => !f.slot || String(s.id) === f.slot).flatMap((s) => s.groups.map((g) => <option key={g.id} value={`${s.id}:${g.id}`}>{g.name} · {s.label}</option>))}
        </select>
        <select aria-label="Coach" value={f.coach} onChange={(e) => setF({ ...f, coach: e.target.value })} className={sel}>
          <option value="">All coaches</option>
          {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="Payment" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={sel}>
          <option value="">Paid & unpaid</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Not paid yet</option>
        </select>
        <span className="text-sm text-muted">{shown.length} players</span>
        <a href={`/management/academy/terms/export?${exportQuery}`} className="ml-auto text-sm underline">Download CSV</a>
      </div>

      {picked.size > 0 && (
        <div className="sticky top-0 z-10 mt-4 space-y-3 rounded-2xl border border-brand bg-surface p-4 shadow-lg">
          <p className="text-sm font-semibold">{picked.size} selected · <button type="button" onClick={() => setPicked(new Set())} className="font-normal underline">clear</button></p>
          <form action={move} className="flex flex-wrap items-center gap-2">
            {hidden}
            <select name="slot" required aria-label="Move to training time" className={sel} value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="" disabled>Move to training time…</option>
              {slots.map((s) => <option key={s.id} value={s.id}>{s.label} · {s.years}</option>)}
            </select>
            <input name="reason" aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (needed if outside their age group)" className={`${sel} min-w-72 flex-1`} />
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="notify" defaultChecked /> Tell paid families</label>
            <button disabled={moving} className={btn}>{moving ? 'Moving…' : 'Move'}</button>
            <div className="basis-full"><Result s={moveState} /></div>
          </form>
          <form action={group} className="flex flex-wrap items-center gap-2">
            {hidden}
            <select name="group" required aria-label="Put in group" className={sel} value={groupPick} onChange={(e) => setGroupPick(e.target.value)}>
              <option value="" disabled>Put in group…</option>
              {slots.map((s) => (
                <optgroup key={s.id} label={s.label}>
                  <option value={`${s.id}:`}>No group</option>
                  {s.groups.map((g) => <option key={g.id} value={`${s.id}:${g.id}`}>{g.name}</option>)}
                </optgroup>
              ))}
            </select>
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="notify" defaultChecked /> Tell paid families</label>
            <button disabled={grouping} className={btn}>{grouping ? 'Saving…' : 'Set group'}</button>
            <div className="basis-full"><Result s={groupState} /></div>
          </form>
        </div>
      )}
      {picked.size === 0 && (moveState.done || groupState.done) && <div className="mt-4"><Result s={moveState.done ? moveState : groupState} /></div>}

      {byYear.length === 0 && <p className="mt-6 text-muted">No players match.</p>}
      {byYear.map(({ y, list }) => (
        <div key={y} className="mt-6 overflow-x-auto rounded-2xl border border-line">
          <div className="flex items-center gap-3 border-b border-line bg-surface-2 px-4 py-2">
            <input type="checkbox" aria-label={`Select all ${y}s`} checked={list.every((r) => picked.has(r.id))} onChange={(e) => toggleAll(list, e.target.checked)} />
            <p className="font-semibold">{y}s <span className="font-normal text-muted">· {list.length} · {list.filter((r) => r.status === 'paid').length} paid</span></p>
          </div>
          <table className="w-full min-w-[56rem] text-sm">
            <tbody className="divide-y divide-line">
              {list.map((r) => (
                <tr key={r.id} className={picked.has(r.id) ? 'bg-brand/5' : ''}>
                  <td className="w-8 px-4 py-2"><input type="checkbox" aria-label={`Select ${r.name}`} checked={picked.has(r.id)} onChange={() => toggle(r.id)} /></td>
                  <td className="py-2 pr-3">
                    <span className="font-semibold">{r.name}</span>
                    {r.medical && <span title="Has medical information" className="ml-1.5 rounded bg-red-100 px-1 text-xs font-semibold text-red-800">Medical</span>}
                    <span className="block text-xs text-muted">{r.placement}</span>
                    {r.moves.length > 0 && <span className="block text-xs text-amber-800" title={r.moves.map((m) => `${m.from} → ${m.to}: ${m.reason}`).join('\n')}>Moved: {r.moves.at(-1)!.reason}</span>}
                  </td>
                  <td className="py-2 pr-3">{r.slotLabel || <span className="text-muted">—</span>}{r.groupName && <span className="block text-xs text-muted">{r.groupName}</span>}</td>
                  <td className="py-2 pr-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{r.statusLabel}</span></td>
                  <td className="py-2 pr-4 text-xs text-muted">{r.parent}<br />{r.phone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
