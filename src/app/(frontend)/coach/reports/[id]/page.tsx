import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireCoach } from '@/academy/portal'
import { payload, formatDate } from '@/lib/payload'
import { coachReport } from '@/academy/reports/service'
import { curriculum, standardFor } from '@/academy/curriculum/load'
import { LEVELS, STRANDS } from '@/academy/curriculum/levels'
import { coachCanEdit, statusLabel, type ReportStatus } from '@/academy/reports/rules'
import { ReportForm } from './ReportForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Player report', robots: { index: false } }

export default async function CoachReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/coach/reports" className="text-sm text-muted underline">← All reports</Link>
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
      <ReportForm
        id={report.id}
        editable={editable}
        strands={strands}
        initial={{ strands: (report.strands ?? []).map((s) => ({ strand: s.strand, rating: s.rating ?? null, comment: s.comment ?? '' })), overall: report.overall ?? '' }}
        savedAt={report.savedAt ?? null}
        firstName={report.playerName.split(' ')[0]}
      />
    </div>
  )
}
