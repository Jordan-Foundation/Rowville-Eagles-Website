import type { StageStatus } from '@/academy/pdr/report'

export function Bar({ percent, colour }: { percent: number; colour?: string | null }) {
  return (
    <div className="h-2 w-full overflow-hidden bg-white/10" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full transition-all" style={{ width: `${percent}%`, background: colour || '#fff' }} />
    </div>
  )
}

const tone: Record<StageStatus, string> = {
  passed_verified: 'bg-emerald-400/20 text-emerald-200',
  passed_promoted: 'bg-emerald-400/20 text-emerald-200',
  not_started: 'bg-white/10 text-white',
  locked: 'bg-white/5 text-muted',
  coming_soon: 'bg-white/5 text-muted',
}
const label: Record<StageStatus, string> = {
  passed_verified: '✓ Passed',
  passed_promoted: '✓ Passed (coach)',
  not_started: 'Not started',
  locked: '🔒 Locked',
  coming_soon: 'Coming soon',
}
export const StatusChip = ({ status }: { status: StageStatus }) => <span className={`shrink-0 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${tone[status]}`}>{label[status]}</span>

export function Crumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap gap-2 text-sm text-muted">
      {items.map((i, n) => (
        <span key={n} className="flex gap-2">
          {n > 0 && <span aria-hidden>/</span>}
          {i.href ? <a href={i.href} className="hover:text-ink">{i.label}</a> : <span className="text-ink">{i.label}</span>}
        </span>
      ))}
    </nav>
  )
}
