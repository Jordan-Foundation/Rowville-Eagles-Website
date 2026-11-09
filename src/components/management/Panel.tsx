import type { ReactNode } from 'react'

/** A titled box on the Family / Player pages. */
export function Panel({ title, count, children, empty }: { title: string; count?: number; children?: ReactNode; empty?: string }) {
  const none = count === 0
  return (
    <section aria-label={title} className="panel border border-line">
      <h2 className="border-b border-line px-5 py-3 font-display text-lg font-semibold uppercase">{title}{count !== undefined ? ` (${count})` : ''}</h2>
      {none ? <p className="px-5 py-4 text-sm text-muted">{empty ?? 'None.'}</p> : <div className="text-sm">{children}</div>}
    </section>
  )
}

export function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-line">
      {rows.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => (
        <div key={k} className="grid grid-cols-[9rem_1fr] gap-3 px-5 py-2.5">
          <dt className="text-muted">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}
