import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireManagement } from '@/lib/management'
import { payload, formatDate } from '@/lib/payload'
import { curriculum, standardFor } from '@/academy/curriculum/load'
import { LEVELS, STRANDS, strandName, levelName } from '@/academy/curriculum/levels'
import { canApprove, canReturn, managementCanEdit, statusLabel } from '@/academy/reports/rules'
import { PlayerReportView } from '@/components/reports/PlayerReportView'
import { ReviewForm } from './ReviewForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Review report', robots: { index: false } }

const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null))

export default async function ReviewReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireManagement(`/management/reports/r/${id}`)
  const p = await payload()
  const r = await p.findByID({ collection: 'player-reports', id: Number(id), depth: 1, overrideAccess: true, disableErrors: true })
  if (!r) notFound()
  const cycle = typeof r.cycle === 'object' ? r.cycle : await p.findByID({ collection: 'report-cycles', id: r.cycle, depth: 0, overrideAccess: true })
  const coach = typeof r.coach === 'object' ? r.coach : null
  const all = await curriculum(p)
  // Next report waiting for review in this cycle (for "Approve & next")
  const { docs: queue } = await p.find({ collection: 'player-reports', where: { cycle: { equals: cycle.id }, status: { equals: 'submitted' }, id: { not_equals: r.id } }, sort: 'playerName', limit: 1, depth: 0, overrideAccess: true, select: { playerName: true } })
  const next = queue[0] ? `/management/reports/r/${queue[0].id}` : `/management/reports/${cycle.id}`
  const historyUsers = new Map<number, string>()
  for (const h of r.history ?? []) { const u = h.by && typeof h.by === 'object' ? h.by : null; if (u) historyUsers.set(u.id, [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email) }
  const rows = STRANDS.map((s) => {
    const e = (r.strands ?? []).find((x) => x.strand === s.key)
    return { strand: s.name, standard: standardFor(all, r.level, s.key)?.standard, rating: e?.rating ?? null, comment: e?.comment }
  })

  return (
    <div className="container-x max-w-4xl py-14">
      <Link href={`/management/reports/${cycle.id}`} className="text-sm text-muted hover:text-ink">← {cycle.name}</Link>
      <h1 className="mt-4 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">{r.playerName}</h1>
      <p className="mt-2 text-muted">
        <strong className="text-ink">{statusLabel(r.status)}</strong> · {levelName(r.level)} · {r.sourceLabel} · written by {coach ? [coach.firstName, coach.lastName].filter(Boolean).join(' ') || coach.email : 'no coach yet'}
        {r.submittedAt ? ` · submitted ${formatDate(r.submittedAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}
      </p>

      <div className="mt-8">
        <PlayerReportView eyebrow={`Player report · ${cycle.name}`} title={`${r.playerName} · ${levelName(r.level)}`} badge={r.status === 'released' ? 'Released' : 'Preview — as families will see it'} rows={rows} overall={r.overall} />
      </div>

      {managementCanEdit(r.status) ? (
        <ReviewForm
          id={r.id}
          next={next}
          level={r.level}
          levels={LEVELS.map((l) => ({ key: l.key, label: l.long }))}
          strands={STRANDS.map((s) => {
            const e = (r.strands ?? []).find((x) => x.strand === s.key)
            return { key: s.key, name: s.name, rating: e?.rating ?? '', comment: e?.comment ?? '' }
          })}
          overall={r.overall ?? ''}
          canApprove={canApprove(r.status)}
          canReturn={canReturn(r.status)}
          returnNote={r.returnNote ?? ''}
        />
      ) : (
        <p className="mt-6 rounded-2xl border border-line p-4 text-sm">Released to the family {r.releasedAt ? formatDate(r.releasedAt, { day: 'numeric', month: 'long', year: 'numeric' }) : ''} — it can no longer be changed here.</p>
      )}

      <h2 className="mt-12 font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">History</h2>
      <ol className="mt-3 divide-y divide-line rounded-2xl border border-line text-sm">
        {(r.history ?? []).slice().reverse().map((h, i) => (
          <li key={h.id ?? i} className="px-4 py-3">
            <span className="font-semibold">{h.action}</span>
            <span className="text-muted"> · {h.at ? formatDate(h.at, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}{idOf(h.by) ? ` · ${historyUsers.get(idOf(h.by)!) ?? `#${idOf(h.by)}`}` : ''}</span>
            {h.note && <p className="mt-1 text-muted">{h.note}</p>}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-muted">Strand codes: {STRANDS.map((s) => `${s.key} = ${strandName(s.key)}`).join(' · ')}</p>
    </div>
  )
}
