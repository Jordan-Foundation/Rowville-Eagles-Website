import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import { payload, formatDate } from '@/lib/payload'
import { canSeeReport, releasedFor, reportCard } from '@/academy/reports/family'
import { PlayerReportView } from '@/components/reports/PlayerReportView'
import { RATINGS, RATING_LABEL } from '@/academy/curriculum/levels'
import { PrintButton } from './PrintButton'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Player report', robots: { index: false } }

export default async function FamilyReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await currentUser()
  if (!user) redirect(`/login?next=/account/reports/${id}`)
  const p = await payload()
  const r = await p.findByID({ collection: 'player-reports', id: Number(id), depth: 1, overrideAccess: true, disableErrors: true })
  if (!r || !(await canSeeReport(p, r, user))) notFound()
  const card = await reportCard(p, r)
  const pid = r.participant && typeof r.participant === 'object' ? r.participant.id : (r.participant as number | null)
  const others = pid ? (await releasedFor(p, pid)).filter((x) => x.id !== r.id) : []

  return (
    <div className="container-x max-w-4xl py-14 print:py-0">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href={pid ? `/account/players/${pid}#reports` : '/account'} className="text-sm text-muted hover:text-ink">← {pid ? r.playerName.split(' ')[0] : 'My account'}</Link>
        <PrintButton />
      </div>
      <p className="mt-6 hidden text-sm font-semibold print:block">Foundation Academy · Rowville Eagles FC</p>
      <div className="mt-6 print:mt-2">
        <PlayerReportView
          eyebrow={`Player report · ${card.cycleName}`}
          title={`${r.playerName} · ${card.level.name}`}
          badge={card.level.phase}
          rows={card.rows}
          overall={r.overall}
          footer={[card.coachName && `Coach ${card.coachName}`, r.releasedAt && `Released ${formatDate(r.releasedAt, { day: 'numeric', month: 'long', year: 'numeric' })}`, r.status !== 'released' && 'Not yet released — Management preview'].filter(Boolean).join(' · ')}
        />
      </div>
      <section className="mt-8 break-inside-avoid text-sm text-muted" aria-label="How to read this report">
        <h2 className="font-semibold text-ink">How to read this report</h2>
        <p className="mt-1">
          Each strand of the Foundation Football Curriculum has a standard for the player’s age ({card.level.long}). The coach rates where your player is against that standard:{' '}
          {RATINGS.map((x) => RATING_LABEL[x]).join(' · ')}. “At” means right where we’d expect for their age — the standard describes the end of the year, so mid-year reports often show “Below” or “At” as players progress.
        </p>
      </section>
      {others.length > 0 && (
        <section className="no-print mt-10">
          <h2 className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">Earlier reports</h2>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
            {others.map((o) => (
              <li key={o.id}><Link href={`/account/reports/${o.id}`} className="flex justify-between gap-3 px-5 py-3 hover:bg-surface-2"><span className="font-semibold">{typeof o.cycle === 'object' ? o.cycle.name : 'Report'}</span><span className="text-sm text-muted">{o.releasedAt ? formatDate(o.releasedAt, { month: 'short', year: 'numeric' }) : ''}</span></Link></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
