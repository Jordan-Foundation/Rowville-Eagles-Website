import Link from 'next/link'

/** KPI tiles — same look as the 1-on-1 dashboard. */
export function KpiTiles({ tiles }: { tiles: [string, string, string?][] }) {
  return (
    <dl className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map(([k, v, sub]) => (
        <div key={k} className="bg-surface p-5">
          <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{k}</dt>
          <dd className="mt-2 font-display text-3xl font-semibold tabular-nums">{v}</dd>
          {sub && <dd className="mt-1 text-sm text-muted">{sub}</dd>}
        </div>
      ))}
    </dl>
  )
}

export const selectCls = 'border border-line bg-surface px-3 py-2 text-sm'

/** A GET filter form that keeps the selected program. */
export function FilterBar({ program, children, note }: { program: string; children: React.ReactNode; note?: string }) {
  return (
    <div>
      <form className="flex flex-wrap items-end gap-2 [&_label]:flex [&_label]:flex-col [&_label]:gap-1 [&_select]:text-sm [&_select]:text-ink [&_input]:text-sm [&_input]:text-ink">
        <input type="hidden" name="program" value={program} />
        {children}
        <button className="bg-white px-4 py-2 text-sm font-semibold uppercase tracking-wider text-black">Apply</button>
      </form>
      {note && <p className="mt-2 text-sm text-muted">{note}</p>}
    </div>
  )
}

export function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-3" title={label}>
      <div className="h-2 flex-1 bg-white/10" role="img" aria-label={label}>
        <div className={`h-2 rounded-r-[4px] ${pct >= 100 ? 'bg-amber-300' : 'bg-white'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-20 text-right tabular-nums">{max > 0 ? `${value} / ${max}` : value}</span>
    </div>
  )
}

export function Heading({ title, sub, links }: { title: string; sub?: string; links?: { href: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-3xl font-semibold uppercase tracking-tight">{title}</h2>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {links && (
        <div className="flex flex-wrap gap-4 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="underline">{l.label}</Link>
          ))}
        </div>
      )}
    </div>
  )
}

export const thCls = 'py-3 pr-4'
