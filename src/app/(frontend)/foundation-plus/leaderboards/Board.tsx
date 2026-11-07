import Link from 'next/link'
import type { BoardRow, Period } from '@/academy/pdr/leaderboard-data'

const medal = (r: number) => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : String(r))

export function Filters({ base, period, age, years }: { base: string; period: Period; age: number | null; years: number[] }) {
  const href = (o: { period?: Period; age?: number | null }) => {
    const q = new URLSearchParams()
    const p = o.period ?? period
    const a = o.age === undefined ? age : o.age
    if (p === 'month') q.set('period', 'month')
    if (a) q.set('age', String(a))
    const s = q.toString()
    return s ? `${base}?${s}` : base
  }
  const chip = (on: boolean) => `px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] ${on ? 'bg-white text-black' : 'border border-line'}`
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={href({ period: 'all' })} className={chip(period === 'all')}>All time</Link>
      <Link href={href({ period: 'month' })} className={chip(period === 'month')}>This month</Link>
      <span className="mx-1 h-5 w-px bg-white/20" aria-hidden />
      <Link href={href({ age: null })} className={chip(!age)}>All ages</Link>
      {years.map((y) => (
        <Link key={y} href={href({ age: y })} className={chip(age === y)}>{y}s</Link>
      ))}
    </div>
  )
}

export function BoardTable({ rows, unit, limit = 50 }: { rows: BoardRow[]; unit: string; limit?: number }) {
  if (!rows.length) return <p className="panel mt-6 border border-line p-6 text-muted">No one on this board yet — be the first!</p>
  const top = rows.slice(0, limit)
  const extra = rows.slice(limit).filter((r) => r.mine)
  const row = (r: BoardRow) => (
    <li key={r.player} className={`grid grid-cols-[3rem_1fr_auto] items-center gap-3 px-5 py-3 ${r.mine ? 'bg-white/10' : ''}`}>
      <span className="font-display text-xl font-bold">{medal(r.rank)}</span>
      <span>
        <span className="font-semibold">{r.name}</span>
        {r.mine && <span className="ml-2 bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase text-black">You</span>}
        {r.birthYear && <span className="ml-2 text-xs text-muted">{r.birthYear}s</span>}
      </span>
      <span className="font-display text-xl font-semibold">{r.value}<span className="ml-1 text-xs font-normal text-muted">{unit}</span></span>
    </li>
  )
  return (
    <ol className="panel mt-6 divide-y divide-line border border-line">
      {top.map(row)}
      {extra.length > 0 && <li className="px-5 py-1 text-center text-xs text-muted">…</li>}
      {extra.map(row)}
    </ol>
  )
}
