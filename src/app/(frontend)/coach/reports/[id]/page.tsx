import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireCoach } from '@/academy/portal'
import { payload, formatDate } from '@/lib/payload'
import { coachReport } from '@/academy/reports/service'
import { curriculum, standardFor } from '@/academy/curriculum/load'
import { LEVELS, STRANDS } from '@/academy/curriculum/levels'
import { coachCanEdit, OUTSTANDING, statusLabel, type ReportStatus } from '@/academy/reports/rules'
import { PlayerReportView } from '@/components/reports/PlayerReportView'
import { reportCard } from '@/academy/reports/family'
import { ReportForm } from './ReportForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Player report', robots: { index: false } }

export default async function CoachReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ submitted?: string }> }) {
  const { id } = await params
  const { submitted } = await searchParams
  const { user } = await requireCoach(`/coach/reports/${id}`)
  const p = await payload()
  const report = await coachReport(p, Number(id), user.id)
  if (!report) notFound()
  const cycle = await p.findByID({ collection: 'report-cycles', id: typeof report.cycle === 'object' ? report.cycle.id : report.cycle, depth: 0, overrideAccess: true })
  const all = await curriculum(p)
  const level = LEVELS.find((l) => l.key === report.level)!
  const strands = STRANDS.map((s) => {
    const st = standardFor(all, report.level, s.key)
    return { key: s.key, name: s.name, standard: st?.standard ?? '', descriptors: st?.descriptors ?? [] }
  })
  const editable = coachCanEdit(report.status as ReportStatus)
  // "Next player": the next report in this round that still needs work (returned, draft, not started)
  const cycleId = typeof report.cycle === 'object' ? report.cycle.id : report.cycle
  const { docs: todo } = await p.find({ pagination: false, collection: 'player-reports', where: { coach: { equals: user.id }, cycle: { equals: cycleId }, status: { in: [...OUTSTANDING] } }, sort: 'playerName', limit: 2000, depth: 0, overrideAccess: true, select: { playerName: true } })
  const after = todo.filter((r) => r.id !== report.id)
  const next = after.find((r) => r.playerName.localeCompare(report.playerName) > 0) ?? after[0] ?? null
  const released = report.status === 'released' || report.status === 'approved'
  const card = released ? await reportCard(p, report) : null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/coach/reports" className="text-sm text-muted underline">← All reports</Link>
        {next && <Link href={`/coach/reports/${next.id}`} className="text-sm font-semibold underline">Next player: {next.playerName} →</Link>}
      </div>
      {submitted && <p role="status" className="border border-emerald-300/60 bg-emerald-500/10 p-3 text-sm text-emerald-200">Report submitted ✓ {after.length ? `${after.length} still to do — here’s the next one.` : 'That was the last one — all done!'}</p>}
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted">{cycle.name} · due {formatDate(cycle.dueDate, { day: 'numeric', month: 'long' })}</p>
        <h1 className="mt-1 font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">{report.playerName}</h1>
        <p className="mt-2 text-muted">
          Reporting at <strong className="text-ink">{level.long}</strong> ({level.phase}){report.birthYear ? ` · born ${report.birthYear}` : ''}{report.sourceLabel ? ` · ${report.sourceLabel}` : ''}
        </p>
        <p className="mt-1 text-xs text-muted">Wrong level? Ask Management — they can change it.</p>
      </div>
      {report.status === 'returned' && report.returnNote && (
        <div role="alert" className="border border-red-400/70 bg-red-500/10 p-4 text-sm">
          <p className="font-semibold text-red-300">Returned by Management — please update and resubmit</p>
          <p className="mt-1 whitespace-pre-line">{report.returnNote}</p>
        </div>
      )}
      {!editable && (
        <p className="border border-line bg-white/5 p-4 text-sm">
          <strong>{statusLabel(report.status)}</strong> — this report is locked{report.submittedAt ? ` (submitted ${formatDate(report.submittedAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })})` : ''}. Management will return it to you if anything needs changing.
        </p>
      )}
      {card && (
        <div>
          <p className="mb-3 text-sm text-muted">{report.status === 'released' ? 'What the family sees:' : 'Approved — this is how families will see it once released:'}</p>
          <PlayerReportView eyebrow={`Player report · ${card.cycleName}`} title={`${report.playerName} · ${card.level.name}`} badge={card.level.phase} rows={card.rows} overall={report.overall} />
        </div>
      )}
      {!card && <ReportForm
        id={report.id}
        editable={editable}
        strands={strands}
        initial={{ strands: (report.strands ?? []).map((s) => ({ strand: s.strand, rating: s.rating ?? null, comment: s.comment ?? '' })), overall: report.overall ?? '' }}
        savedAt={report.savedAt ?? null}
        firstName={report.playerName.split(' ')[0]}
        nextId={next?.id ?? null}
      />}
    </div>
  )
}
