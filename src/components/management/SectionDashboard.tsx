'use client'

import Link from 'next/link'
import { DashboardGrid } from '@/components/dashboard/DashboardGrid'
import { useLiveCounts } from '@/components/dashboard/LiveDashboard'
import { badgeLabel, badgeMeaning } from '@/components/dashboard/badge'
import type { ManagementSection } from '@/app/(frontend)/management/items'

/**
 * Management home: a short "Needs attention" list (only things with something to do, each linking straight there),
 * then one button per category — its badge is the total of everything inside it.
 */
export function SectionDashboard({ sections, initial }: { sections: ManagementSection[]; initial: Record<string, number> }) {
  const counts = useLiveCounts(initial, 'management')
  const todo = sections.flatMap((s) => s.items.map((i) => ({ i, s, n: counts[i.key] ?? 0 }))).filter((x) => x.n > 0)
  const tiles = sections.map((s) => ({ key: `area-${s.key}`, href: s.href ?? `/management/area/${s.key}`, label: s.label, hint: s.hint, icon: s.icon, count: s.items.reduce((n, i) => n + (counts[i.key] ?? 0), 0), quiet: !s.href }))
  return (
    <div className="space-y-10">
      <section aria-label="Needs attention" className="panel border border-line">
        <h2 className="border-b border-line px-5 py-3 font-display text-xl font-semibold uppercase">Needs attention</h2>
        {todo.length ? (
          <ul className="divide-y divide-line">
            {todo.map(({ i, s, n }) => (
              <li key={i.key}>
                <Link href={i.href} data-attn={i.key} aria-label={badgeLabel(i.label, n, badgeMeaning(i.key, n, 'management'))} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-white/5">
                  <span>
                    <span className="font-semibold">{i.label}</span>
                    {!s.href && <span className="block text-xs text-muted">{s.label}</span>}
                  </span>
                  <span className="flex items-center gap-3 text-right text-sm font-semibold text-red-400">
                    {badgeMeaning(i.key, n, 'management')}
                    <span aria-hidden className="text-muted">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-4 text-sm text-muted">All clear — nothing needs you right now.</p>
        )}
      </section>
      <DashboardGrid items={tiles} role="management" />
    </div>
  )
}
