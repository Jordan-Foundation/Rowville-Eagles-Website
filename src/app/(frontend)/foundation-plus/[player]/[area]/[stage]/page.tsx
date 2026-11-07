import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/payload'
import { foundationGate, loadReport, reportPlayer, streamEmbed } from '@/academy/pdr/load'
import { criteriaSummary } from '@/academy/pdr/content'
import { STATUS_LABEL, stageSlug } from '@/academy/pdr/report'
import type { PdrVideo } from '@/payload-types'
import { Crumbs, StatusChip } from '../../../ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Stage', robots: { index: false } }

function Video({ title, video }: { title: string; video: PdrVideo | null }) {
  const src = streamEmbed(video?.streamUid)
  return (
    <figure>
      <figcaption className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">{title}</figcaption>
      {src ? (
        <div className="relative aspect-video border border-line bg-black">
          <iframe src={src} title={`${title}: ${video!.title}`} allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen className="absolute inset-0 h-full w-full" />
        </div>
      ) : (
        <div className="grid aspect-video place-items-center border border-dashed border-line text-sm text-muted">Video coming soon</div>
      )}
    </figure>
  )
}

export default async function StagePage({ params }: { params: Promise<{ player: string; area: string; stage: string }> }) {
  const { player, area: slug, stage: code } = await params
  const { p, settings, user } = await foundationGate()
  const kid = await reportPlayer(p, user, player, `/foundation-plus/${player}/${slug}/${code}`)
  const { report } = await loadReport(p, kid)
  const a = report.find((x) => x.area.slug === slug)
  const level = a?.levels.find((l) => l.stages.some((s) => stageSlug(s.stage) === code))
  const row = level?.stages.find((s) => stageSlug(s.stage) === code)
  if (!a || !level || !row) notFound()
  const doc = await p.findByID({ collection: 'pdr-stages', id: row.stage.id, depth: 1, overrideAccess: true })
  const coming = row.status === 'coming_soon'
  const locked = row.status === 'locked'

  return (
    <div className="max-w-4xl">
      <Crumbs items={[{ href: '/foundation-plus', label: settings.name }, { href: `/foundation-plus/${kid.id}`, label: kid.firstName }, { href: `/foundation-plus/${kid.id}/${a.area.slug}`, label: a.area.name }, { label: row.stage.code }]} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{row.stage.code}</p>
          <h1 className="mt-2 font-display text-4xl font-bold uppercase tracking-tight sm:text-5xl">{coming ? 'Coming soon' : doc.skillName}</h1>
        </div>
        <StatusChip status={row.status} />
      </div>

      {coming ? (
        <p className="panel mt-8 border border-line p-6 text-muted">Our coaches are still putting this skill together. Check back soon!</p>
      ) : locked ? (
        <p className="panel mt-8 border border-line p-6">🔒 {level.lockMessage}</p>
      ) : null}

      {!coming && (
        <div className={`mt-8 space-y-8 ${locked ? 'pointer-events-none select-none opacity-40 blur-[1px]' : ''}`} aria-hidden={locked || undefined}>
          {row.progress && (
            <p className="panel border border-emerald-400/40 p-5">
              {STATUS_LABEL[row.status]}
              {row.progress.score != null ? ` · score ${row.progress.score}` : ''}
              {row.progress.passedAt ? ` · ${formatDate(row.progress.passedAt, { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
            </p>
          )}
          <div className="grid gap-6 md:grid-cols-2">
            <Video title="Tutorial" video={doc.tutorialVideo as PdrVideo | null} />
            <Video title="Demonstration" video={doc.demoVideo as PdrVideo | null} />
          </div>
          <section className="panel gloss-sheen border border-line p-6">
            <h2 className="font-display text-xl font-semibold uppercase">The challenge</h2>
            {doc.scoring === 'scored' && criteriaSummary(doc.criteria) && <p className="mt-2 text-2xl font-bold">{criteriaSummary(doc.criteria)}</p>}
            {doc.scoring === 'judged' && <p className="mt-2 text-sm text-muted">Judged by an Academy coach</p>}
            {doc.challenge && <p className="mt-3 whitespace-pre-line text-muted">{doc.challenge}</p>}
          </section>
          {doc.technique && (
            <section>
              <h2 className="font-display text-xl font-semibold uppercase">Technique</h2>
              <p className="mt-2 whitespace-pre-line text-muted">{doc.technique}</p>
            </section>
          )}
          {(doc.coachingPoints?.length ?? 0) > 0 && (
            <section>
              <h2 className="font-display text-xl font-semibold uppercase">Coaching points</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">{doc.coachingPoints!.map((c) => <li key={c.id}>{c.point}</li>)}</ul>
            </section>
          )}
          {!row.progress && (
            <section className="panel border border-dashed border-line p-6">
              <p className="font-semibold">Ready to try it?</p>
              <p className="mt-1 text-sm text-muted">Uploading your challenge video for a coach to check is coming soon. Until then, show your coach at training — they can mark it as passed.</p>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
