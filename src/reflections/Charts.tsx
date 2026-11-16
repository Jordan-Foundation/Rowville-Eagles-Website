import type { PillarStat } from './rules'

/**
 * Small server-rendered charts (HTML/SVG, no library). Two series, fixed colours:
 * “Did well” = blue, “To work on” = orange (a validated colour-blind-safe pair), always with a legend and numbers.
 */
export const SERIES = { great: '#2a78d6', improve: '#eb6834' } as const

export function Legend() {
  return (
    <p className="flex flex-wrap gap-4 text-xs text-muted" aria-hidden>
      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.great }} />Did well</span>
      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.improve }} />To work on</span>
    </p>
  )
}

/** Strengths vs improvements by pillar: paired horizontal bars, value at the end of each. */
export function PillarBars({ pillars, caption }: { pillars: PillarStat[]; caption?: string }) {
  const max = Math.max(1, ...pillars.flatMap((p) => [p.great, p.improve]))
  return (
    <figure className="space-y-3">
      {caption && <figcaption className="font-semibold">{caption}</figcaption>}
      <Legend />
      <div className="space-y-3" role="table" aria-label={caption ?? 'Did well and to work on by skill area'}>
        {pillars.map((p) => (
          <div key={p.pillar} role="row" className="grid grid-cols-[7.5rem_1fr] items-center gap-3 text-sm">
            <span role="rowheader" className="truncate">{p.name}</span>
            <div className="space-y-[2px]">
              {(['great', 'improve'] as const).map((k) => (
                <div key={k} role="cell" className="flex items-center gap-2" title={`${p.name} — ${k === 'great' ? 'did well' : 'to work on'}: ${p[k]}`}>
                  <span className="block h-3 rounded-r" style={{ width: `${(p[k] / max) * 85}%`, minWidth: p[k] ? 4 : 0, background: SERIES[k] }} />
                  <span className="text-xs tabular-nums text-muted">{p[k]}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </figure>
  )
}

/** One measure per week as vertical bars (e.g. average feeling, completion %), labelled. */
export function WeekBars({ rows, max, format, caption, colour = SERIES.great }: { rows: { week: string; value: number | null }[]; max: number; format: (v: number) => string; caption: string; colour?: string }) {
  return (
    <figure>
      <figcaption className="font-semibold">{caption}</figcaption>
      {rows.length === 0 ? <p className="mt-2 text-sm text-muted">No data yet.</p> : (
        <div className="mt-3 flex h-40 items-end gap-2 overflow-x-auto border-b border-line pb-0">
          {rows.map((r) => (
            <div key={r.week} className="flex h-full min-w-10 flex-1 flex-col items-center justify-end gap-1" title={`Week of ${r.week}: ${r.value == null ? 'no data' : format(r.value)}`}>
              <span className="text-xs tabular-nums text-muted">{r.value == null ? '–' : format(r.value)}</span>
              <span className="block w-full max-w-10 rounded-t" style={{ height: `${r.value == null ? 0 : Math.max(2, (r.value / max) * 100)}%`, background: colour }} />
            </div>
          ))}
        </div>
      )}
      {rows.length > 0 && <div className="mt-1 flex gap-2 overflow-x-auto">{rows.map((r) => <span key={r.week} className="min-w-10 flex-1 text-center text-[10px] text-muted">{r.week.slice(5)}</span>)}</div>}
    </figure>
  )
}

/** Pillar trends: one small chart per pillar, did-well and to-work-on counts per week as two lines. */
export function PillarTrends({ weeks, series }: { weeks: string[]; series: { name: string; great: number[]; improve: number[] }[] }) {
  if (weeks.length < 2) return <p className="text-sm text-muted">Trends appear after two weeks of reflections.</p>
  const W = 220
  const H = 70
  const max = Math.max(1, ...series.flatMap((s) => [...s.great, ...s.improve]))
  const x = (i: number) => 6 + (i / (weeks.length - 1)) * (W - 12)
  const y = (v: number) => H - 6 - (v / max) * (H - 14)
  const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <div className="space-y-3">
      <Legend />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {series.map((s) => (
          <figure key={s.name} className="rounded-xl border border-line p-3">
            <figcaption className="text-sm font-semibold">{s.name}</figcaption>
            <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-auto w-full" role="img" aria-label={`${s.name}: did well ${s.great.join(', ')}; to work on ${s.improve.join(', ')} (weeks ${weeks[0]} to ${weeks[weeks.length - 1]})`}>
              <line x1={6} x2={W - 6} y1={H - 6} y2={H - 6} stroke="currentColor" strokeOpacity={0.15} />
              {(['great', 'improve'] as const).map((k) => (
                <g key={k}>
                  <path d={path(s[k])} fill="none" stroke={SERIES[k]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {s[k].map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={4} fill={SERIES[k]} stroke="var(--color-surface, #fff)" strokeWidth={2}><title>{`Week of ${weeks[i]} — ${k === 'great' ? 'did well' : 'to work on'}: ${v}`}</title></circle>)}
                </g>
              ))}
            </svg>
            <p className="text-xs text-muted">Latest week: {s.great[s.great.length - 1]} did well · {s.improve[s.improve.length - 1]} to work on</p>
          </figure>
        ))}
      </div>
    </div>
  )
}
