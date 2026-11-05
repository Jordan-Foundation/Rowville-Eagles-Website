import Link from 'next/link'
import type { Program } from '@/payload-types'
import { programTypes } from '@/collections/Programs'
import { formatAUD, formatDate } from '@/lib/payload'

export function ProgramCard({ p }: { p: Program }) {
  const typeLabel = programTypes.find((t) => t.value === p.type)?.label
  return (
    <Link
      href={`/programs/${p.slug}`}
      className="group flex flex-col rounded-2xl border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-xl hover:shadow-black/5"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">{typeLabel}</span>
        {p.status === 'full' && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">Waitlist</span>}
      </div>
      <h3 className="mt-3 font-display text-2xl font-bold leading-tight">{p.title}</h3>
      <p className="mt-2 flex-1 text-sm text-muted">{p.summary}</p>
      <dl className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        {p.startDate && <div><dt className="sr-only">Starts</dt><dd>{formatDate(p.startDate)}</dd></div>}
        {p.ageRange && <div><dt className="sr-only">Ages</dt><dd>{p.ageRange}</dd></div>}
      </dl>
      <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
        <span className="text-lg font-semibold">{formatAUD(p.price)}</span>
        <span className="text-sm font-semibold text-ink transition group-hover:text-accent">View details →</span>
      </div>
    </Link>
  )
}
