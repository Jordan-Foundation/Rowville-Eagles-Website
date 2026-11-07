import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { foundationGate, loadReport, reportPlayer } from '@/academy/pdr/load'
import { stageSlug } from '@/academy/pdr/report'
import { Bar, Crumbs, StatusChip } from '../../ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Area', robots: { index: false } }

export default async function AreaPage({ params }: { params: Promise<{ player: string; area: string }> }) {
  const { player, area: slug } = await params
  const { p, settings, user } = await foundationGate()
  const kid = await reportPlayer(p, user, player, `/foundation-plus/${player}/${slug}`)
  const { report } = await loadReport(p, kid)
  const a = report.find((x) => x.area.slug === slug)
  if (!a) notFound()

  return (
    <div>
      <Crumbs items={[{ href: '/foundation-plus', label: settings.name }, { href: `/foundation-plus/${kid.id}`, label: kid.firstName }, { label: a.area.name }]} />
      <h1 className="font-display text-5xl font-bold uppercase tracking-tight">{a.area.name}</h1>
      <div className="mt-4 max-w-md"><Bar percent={a.percent} colour={a.area.colour} /></div>
      <p className="mt-2 text-sm text-muted">{a.passed} of {a.total} stages · {a.area.hasLeaderboard ? 'Has a leaderboard' : 'No leaderboard — judged by coaches'}</p>

      <div className="mt-10 space-y-6">
        {a.levels.map((l) => (
          <section key={l.level.id} className={`panel border border-line ${l.available ? '' : 'opacity-70'}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line p-5">
              <h2 className="font-display text-2xl font-semibold uppercase">
                {!l.available && <span aria-label="Locked">🔒 </span>}Level {l.level.number}{l.level.title ? ` · ${l.level.title}` : ''}
              </h2>
              <span className="text-sm text-muted">{l.complete ? 'Complete ✓' : `${l.passed}/${l.total} passed`}</span>
            </div>
            {l.lockMessage && <p className="border-b border-line px-5 py-3 text-sm">{l.lockMessage}</p>}
            <ul className="divide-y divide-line">
              {l.stages.map(({ stage, status }) => (
                <li key={stage.id}>
                  <Link href={`/foundation-plus/${kid.id}/${a.area.slug}/${stageSlug(stage)}`} className="flex items-center justify-between gap-3 p-5 transition hover:bg-white/5">
                    <span>
                      <span className="block text-xs uppercase tracking-[0.2em] text-muted">{stage.code}</span>
                      <span className="font-semibold">{status === 'coming_soon' ? 'New skill coming soon' : stage.skillName}</span>
                    </span>
                    <StatusChip status={status} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
