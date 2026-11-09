'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

type Row = { id: number; name: string; level: string; status: string; statusLabel: string; group: string }
const TODO = ['returned', 'draft', 'not_started']

/** Reports in this round, filtered instantly by name, status and group. */
export function ReportList({ rows, tone, initialStatus }: { rows: Row[]; tone: Record<string, string>; initialStatus: string }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState(initialStatus || 'todo')
  const [group, setGroup] = useState('')
  const groups = useMemo(() => [...new Set(rows.map((r) => r.group))].filter(Boolean), [rows])
  const counts = useMemo(() => ({ todo: rows.filter((r) => TODO.includes(r.status)).length, submitted: rows.filter((r) => r.status === 'submitted').length, done: rows.filter((r) => r.status === 'approved' || r.status === 'released').length, all: rows.length }), [rows])
  const shown = rows.filter((r) =>
    (status === 'all' || (status === 'todo' ? TODO.includes(r.status) : status === 'done' ? r.status === 'approved' || r.status === 'released' : r.status === status)) &&
    (!group || r.group === group) &&
    (!q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase())),
  )
  const chip = (key: string, label: string) => (
    <button key={key} type="button" onClick={() => setStatus(key)} aria-pressed={status === key} className={`min-h-10 border px-3 text-sm font-semibold ${status === key ? 'border-white bg-white text-black' : 'border-line text-muted hover:text-ink'}`}>{label}</button>
  )
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" aria-label="Show">
        {chip('todo', `To do (${counts.todo})`)}
        {chip('submitted', `Submitted (${counts.submitted})`)}
        {chip('done', `Approved / released (${counts.done})`)}
        {chip('all', `All (${counts.all})`)}
      </div>
      <div className="flex flex-wrap gap-2">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a player" aria-label="Find a player" className="min-h-10 w-full border border-line bg-black/40 px-3 text-sm sm:w-64" />
        {groups.length > 1 && (
          <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Group or team" className="min-h-10 border border-line bg-black/40 px-3 text-sm">
            <option value="">All groups &amp; teams</option>
            {groups.map((g) => <option key={g}>{g}</option>)}
          </select>
        )}
      </div>
      {shown.length === 0 ? <p className="text-muted">{status === 'todo' && !q && !group ? 'Nothing left to do — all done!' : 'No reports match.'}</p> : (
        <ul className="divide-y divide-line border border-line">
          {shown.map((r) => (
            <li key={r.id}>
              <Link href={`/coach/reports/${r.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-white/5">
                <span>
                  <span className="font-semibold">{r.name}</span>
                  <span className="ml-2 text-sm text-muted">{r.level}</span>
                  {r.group && <span className="block text-xs text-muted">{r.group}</span>}
                </span>
                <span className={`shrink-0 border px-2 py-0.5 text-xs font-semibold uppercase ${tone[r.status] ?? ''}`}>{r.statusLabel}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
