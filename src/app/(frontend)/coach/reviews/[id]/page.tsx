import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { payload, formatDate } from '@/lib/payload'
import { requireCoach } from '@/academy/portal'
import { birthYearOf, groupLabel } from '@/lib/age-groups'
import { criteriaSummary } from '@/academy/pdr/content'
import { getVideo, playbackUrl, streamConfigured } from '@/academy/pdr/stream'
import { stageSlug } from '@/academy/pdr/report'
import type { Participant, PdrArea, PdrChallenge, PdrStage } from '@/payload-types'
import { monthLabel } from '@/academy/pdr/challenge-rules'
import { ReviewForm } from '../ReviewForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Review video', robots: { index: false } }

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCoach('/coach/reviews')
  const { id } = await params
  const p = await payload()
  const sub = await p.findByID({ collection: 'pdr-submissions', id: Number(id), depth: 2, overrideAccess: true, disableErrors: true })
  if (!sub) notFound()
  const kid = sub.player as Participant
  const by = birthYearOf(kid.dateOfBirth)
  let video: { url: string | null; state: string } = { url: null, state: 'missing' }
  if (sub.streamUid && !sub.videoDeletedAt && streamConfigured()) {
    try {
      const v = await getVideo(sub.streamUid)
      video = { url: v.readyToStream ? await playbackUrl(sub.streamUid) : null, state: v.readyToStream ? 'ready' : (v.status?.state ?? 'processing') }
    } catch {
      video = { url: null, state: 'error' }
    }
  }
  const ch = sub.challenge as PdrChallenge | null
  if (sub.type === 'challenge' && ch) {
    const { myEntries } = await import('@/academy/pdr/challenges')
    const mine = await myEntries(p, ch, kid.id)
    return (
      <div className="space-y-8">
        <Link href="/coach/reviews" className="text-sm text-muted hover:text-ink">← Reviews</Link>
        <div>
          <p className="eyebrow">Monthly challenge entry · {formatDate(sub.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
          <h1 className="mt-2 font-display text-4xl font-semibold uppercase">{kid.firstName} {kid.lastName} <span className="text-2xl text-muted">{by ? groupLabel(by) : ''}</span></h1>
          <p className="mt-2 text-muted">{monthLabel(ch.month)} challenge — {ch.title}</p>
        </div>
        <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-4">
            {video.url ? (
              <div className="relative aspect-video border border-line bg-black"><iframe src={video.url} title="Player video" allow="encrypted-media; picture-in-picture" allowFullScreen className="absolute inset-0 h-full w-full" /></div>
            ) : (
              <div className="grid aspect-video place-items-center border border-dashed border-line text-sm text-muted">{video.state === 'error' ? 'This video couldn’t be processed. Ask the player to send another.' : video.state === 'missing' ? 'Video not available.' : 'Still processing — refresh in a minute.'}</div>
            )}
            <dl className="panel grid gap-2 border border-line p-5 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2"><dt className="text-muted">The challenge</dt><dd>{ch.description}</dd></div>
              {ch.rules && <div className="sm:col-span-2"><dt className="text-muted">How it should be filmed</dt><dd className="whitespace-pre-line">{ch.rules}</dd></div>}
              <div><dt className="text-muted">Player says</dt><dd>{sub.claimedScore != null ? `${sub.claimedScore} ${ch.unit}` : '—'}</dd></div>
              <div><dt className="text-muted">Best counted so far</dt><dd>{mine.best != null ? `${mine.best} ${ch.unit}` : '—'}</dd></div>
              {sub.playerNote && <div className="sm:col-span-2"><dt className="text-muted">Player’s note</dt><dd className="whitespace-pre-line">{sub.playerNote}</dd></div>}
            </dl>
          </div>
          <aside className="panel h-fit border border-line p-5">
            {sub.status === 'pending' ? (
              <ReviewForm id={sub.id} type="verification" scored claimed={sub.claimedScore ?? null} unit={ch.unit} target={`${ch.direction === 'lower' ? 'lowest' : 'highest'} wins — any score counts`} rejectLabel="Doesn’t count" />
            ) : (
              <p className="text-sm">Already reviewed{sub.reviewedAt ? ` on ${formatDate(sub.reviewedAt, { day: 'numeric', month: 'short' })}` : ''}: {sub.status}{sub.verifiedScore != null ? ` · ${sub.verifiedScore}` : ''}.{sub.feedback ? ` “${sub.feedback}”` : ''}</p>
            )}
          </aside>
        </div>
      </div>
    )
  }
  if (!sub.stage) notFound()
  const stage = sub.stage as PdrStage
  const area = stage.area as PdrArea
  const { docs: history } = await p.find({ collection: 'pdr-progress', where: { player: { equals: kid.id }, stage: { equals: stage.id } }, limit: 1, depth: 0, overrideAccess: true })
  const best = history[0]

  return (
    <div className="space-y-8">
      <Link href="/coach/reviews" className="text-sm text-muted hover:text-ink">← Reviews</Link>
      <div>
        <p className="eyebrow">{sub.type === 'feedback' ? 'Feedback request' : 'Challenge attempt'} · {formatDate(sub.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold uppercase">{kid.firstName} {kid.lastName} <span className="text-2xl text-muted">{by ? groupLabel(by) : ''}</span></h1>
        <p className="mt-2 text-muted">{stage.code} — {stage.skillName}</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          {video.url ? (
            <div className="relative aspect-video border border-line bg-black"><iframe src={video.url} title="Player video" allow="encrypted-media; picture-in-picture" allowFullScreen className="absolute inset-0 h-full w-full" /></div>
          ) : (
            <div className="grid aspect-video place-items-center border border-dashed border-line text-sm text-muted">
              {video.state === 'error' ? 'This video couldn’t be processed (it may be too long). Ask the player to send another.' : video.state === 'missing' ? 'Video not available.' : 'Still processing — refresh in a minute.'}
            </div>
          )}
          <dl className="panel grid gap-2 border border-line p-5 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">Challenge</dt><dd>{stage.scoring === 'judged' ? 'Judged by a coach' : criteriaSummary(stage.criteria)}</dd></div>
            <div><dt className="text-muted">Player says</dt><dd>{sub.claimedScore != null ? `${sub.claimedScore} ${stage.criteria?.unit ?? ''}` : '—'}</dd></div>
            <div><dt className="text-muted">Best so far</dt><dd>{best ? (best.score != null ? `${best.score} (verified)` : best.method === 'promoted' ? 'Passed (coach-promoted)' : 'Passed') : 'Not passed yet'}</dd></div>
            {sub.playerNote && <div className="sm:col-span-2"><dt className="text-muted">Player’s note</dt><dd className="whitespace-pre-line">{sub.playerNote}</dd></div>}
          </dl>
          <Link href={`/foundation-plus/${kid.id}/${area.slug}/${stageSlug({ levelNumber: stage.levelNumber ?? 0, stageNumber: stage.stageNumber })}`} className="text-sm underline">Open this stage on {kid.firstName}’s Foundation+ player page</Link>
        </div>
        <aside className="panel h-fit border border-line p-5">
          {sub.status === 'pending' ? (
            <ReviewForm id={sub.id} type={sub.type} scored={stage.scoring === 'scored'} claimed={sub.claimedScore ?? null} unit={stage.criteria?.unit ?? ''} target={criteriaSummary(stage.criteria)} />
          ) : (
            <p className="text-sm">Already reviewed{sub.reviewedAt ? ` on ${formatDate(sub.reviewedAt, { day: 'numeric', month: 'short' })}` : ''}: {sub.status}{sub.verifiedScore != null ? ` · ${sub.verifiedScore}` : ''}.{sub.feedback ? ` “${sub.feedback}”` : ''}</p>
          )}
        </aside>
      </div>
    </div>
  )
}
