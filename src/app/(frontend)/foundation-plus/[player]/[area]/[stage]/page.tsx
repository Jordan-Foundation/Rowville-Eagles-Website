import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/payload'
import { foundationGate, isStaffOrCoach, loadReport, reportPlayer, streamEmbed } from '@/academy/pdr/load'
import { canSubmit, monthStart } from '@/academy/pdr/rules'
import { playbackUrl, streamConfigured } from '@/academy/pdr/stream'
import { SubmitForm } from './SubmitForm'
import { PromoteForm } from './PromoteForm'
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
  const staff = isStaffOrCoach(user)
  const path = `/foundation-plus/${kid.id}/${a.area.slug}/${code}`
  const [{ docs: subs }, settingsDoc, { totalDocs: feedbackUsed }] = await Promise.all([
    p.find({ collection: 'pdr-submissions', where: { player: { equals: kid.id }, stage: { equals: row.stage.id }, status: { not_equals: 'uploading' } }, sort: '-createdAt', limit: 10, depth: 0, overrideAccess: true }),
    p.findGlobal({ slug: 'pdr-settings', depth: 0, overrideAccess: true }),
    p.count({ collection: 'pdr-submissions', where: { player: { equals: kid.id }, type: { equals: 'feedback' }, status: { not_equals: 'uploading' }, createdAt: { greater_than_equal: new Date(`${monthStart(new Date())}T00:00:00+10:00`).toISOString() } }, overrideAccess: true }),
  ])
  const tier = (kid.pdr?.tier ?? 'free') as 'free' | 'standard' | 'premium'
  const pending = subs.filter((x) => x.status === 'pending').length
  const allowance = settingsDoc.feedbackPerMonth ?? 2
  const check = canSubmit({ type: 'verification', status: row.status, tier, pendingOnStage: pending, feedbackThisMonth: feedbackUsed, feedbackPerMonth: allowance })
  const videos = new Map<number, string | null>()
  if (streamConfigured()) {
    await Promise.all(subs.filter((x) => x.streamUid && !x.videoDeletedAt).map(async (x) => videos.set(x.id, await playbackUrl(x.streamUid!).catch(() => null))))
  }
  const statusText: Record<string, string> = { pending: 'Waiting for a coach', verified: 'Verified', rejected: 'Needs another attempt', feedback_given: 'Feedback' }

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
              {row.progress.score != null ? ` · best score ${row.progress.score}` : row.progress.promotedScore != null ? ` · ${row.progress.promotedScore} seen by the coach` : ''}
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
          <section className="panel border border-line p-6">
            <h2 className="font-display text-xl font-semibold uppercase">{row.progress ? 'Beat your score' : 'Send your attempt'}</h2>
            <p className="mt-1 mb-4 text-sm text-muted">
              {row.progress ? 'Send another video any time — a coach checks it and your best verified score is kept.' : 'Film the whole challenge in one clip. A coach checks it and you’ll get an email.'}
              {` Clips up to ${settingsDoc.maxClipSeconds ?? 90} seconds.`}
            </p>
            <SubmitForm
              player={kid.id}
              stage={row.stage.id}
              path={path}
              scored={doc.scoring === 'scored'}
              unit={doc.criteria?.unit ?? ''}
              premium={tier === 'premium'}
              feedbackLeft={Math.max(0, allowance - feedbackUsed)}
              canAttempt={check.ok ? null : check.reason}
            />
          </section>

          {subs.length > 0 && (
            <section>
              <h2 className="font-display text-xl font-semibold uppercase">Your videos</h2>
              <ul className="mt-3 space-y-3">
                {subs.map((x) => (
                  <li key={x.id} className="panel border border-line p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>{formatDate(x.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })} · {x.type === 'feedback' ? 'Feedback video' : 'Challenge attempt'}{x.claimedScore != null ? ` · you said ${x.claimedScore}` : ''}{x.verifiedScore != null ? ` · coach counted ${x.verifiedScore}` : ''}</span>
                      <span className={`px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${x.status === 'verified' ? 'bg-emerald-400/20 text-emerald-200' : x.status === 'rejected' ? 'bg-amber-400/20 text-amber-200' : 'bg-white/10'}`}>{statusText[x.status] ?? x.status}</span>
                    </div>
                    {x.feedback && <p className="mt-2 whitespace-pre-line text-sm"><span className="text-muted">Coach: </span>{x.feedback}</p>}
                    {videos.get(x.id) ? (
                      <details className="mt-2 text-sm">
                        <summary className="cursor-pointer text-muted">Watch video</summary>
                        <div className="relative mt-2 aspect-video bg-black"><iframe src={videos.get(x.id)!} title="Submitted video" allow="encrypted-media; picture-in-picture" allowFullScreen className="absolute inset-0 h-full w-full" /></div>
                      </details>
                    ) : x.videoDeletedAt ? (
                      <p className="mt-2 text-xs text-muted">Video deleted after review (we keep the score and feedback).</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {staff && !row.progress && (
            <section className="panel border border-amber-400/40 p-6">
              <h2 className="font-display text-xl font-semibold uppercase">Coach: mark as passed</h2>
              <p className="mt-1 mb-4 text-sm text-muted">Saw {kid.firstName} do this in person? Mark it passed — it unlocks the next level and counts towards badges, but promoted scores never go on leaderboards.</p>
              <PromoteForm player={kid.id} stage={row.stage.id} path={path} unit={doc.criteria?.unit ?? ''} />
            </section>
          )}
        </div>
      )}
    </div>
  )
}
