import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { formatDate } from '@/lib/payload'
import { foundationGate, isStaffOrCoach, streamEmbed } from '@/academy/pdr/load'
import { challengeBoard, myEntries } from '@/academy/pdr/challenges'
import { canEnterChallenge, challengeState, daysLeft, monthLabel } from '@/academy/pdr/challenge-rules'
import { myPlayers } from '@/academy/pdr/leaderboard-data'
import { streamConfigured } from '@/academy/pdr/stream'
import type { Participant, PdrVideo } from '@/payload-types'
import { SubmitForm } from '../../[player]/[area]/[stage]/SubmitForm'
import { Crumbs } from '../../ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Monthly challenge', robots: { index: false } }

const STATUS: Record<string, string> = { pending: 'Waiting for a coach', verified: 'Counted', rejected: 'Didn’t count', uploading: 'Uploading' }

export default async function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { p, settings, user } = await foundationGate()
  if (!user) redirect(`/login?next=/foundation-plus/challenges/${id}`)
  const ch = await p.findByID({ collection: 'pdr-challenges', id: Number(id), depth: 1, overrideAccess: true, disableErrors: true })
  const staff = isStaffOrCoach(user)
  if (!ch || (!ch.published && !staff) || (challengeState(ch.month) === 'upcoming' && !staff)) notFound()
  const state = challengeState(ch.month)
  const mine = await myPlayers(p, user.id)
  const { docs: kids } = await p.find({ collection: 'participants', where: { account: { equals: user.id } }, limit: 20, depth: 0, overrideAccess: true })
  const [board, entries] = await Promise.all([challengeBoard(p, ch, mine), Promise.all(kids.map(async (k) => ({ kid: k as Participant, ...(await myEntries(p, ch, k.id)) })))])
  const demo = streamEmbed((ch.demoVideo as PdrVideo | null)?.streamUid)
  const path = `/foundation-plus/challenges/${ch.id}`

  return (
    <div>
      <Crumbs items={[{ href: '/foundation-plus', label: settings.name }, { href: '/foundation-plus/challenges', label: 'Monthly challenges' }, { label: monthLabel(ch.month) }]} />
      <p className="eyebrow">{monthLabel(ch.month)} challenge · {state === 'open' ? `${daysLeft(ch.month)} day${daysLeft(ch.month) === 1 ? '' : 's'} left` : state === 'upcoming' ? 'Starts soon (preview)' : ch.closedAt ? 'Final results' : 'Finished — results once every entry is checked'}</p>
      <h1 className="mt-2 font-display text-5xl font-bold uppercase tracking-tight">{ch.title}</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <p className="text-lg">{ch.description}</p>
          {demo ? (
            <div className="relative aspect-video border border-line bg-black"><iframe src={demo} title={`Demo: ${ch.title}`} allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen className="absolute inset-0 h-full w-full" /></div>
          ) : null}
          {ch.rules && (
            <div className="panel border border-line p-5">
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">How to film it</h2>
              <p className="mt-2 whitespace-pre-line text-sm">{ch.rules}</p>
            </div>
          )}
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="panel border border-line p-4"><dt className="text-muted">Score</dt><dd className="font-semibold">{ch.direction === 'lower' ? 'Lowest' : 'Highest'} {ch.unit} wins</dd></div>
            <div className="panel border border-line p-4"><dt className="text-muted">Winners</dt><dd className="font-semibold">{ch.winnersPerGroup ?? 1} {ch.groupBy === 'all' ? 'overall' : 'per year of birth'}</dd></div>
            <div className="panel border border-line p-4"><dt className="text-muted">Prize</dt><dd className="font-semibold">{ch.prize || '—'}</dd></div>
          </dl>

          <section>
            <h2 className="font-display text-2xl font-semibold uppercase">{board.final ? 'Final results' : 'Live standings'}</h2>
            <p className="text-sm text-muted">Coach-checked scores only. {board.final ? '' : 'Updates as videos are checked.'}</p>
            {board.groups.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No scores yet — be the first!</p>
            ) : (
              <div className="mt-4 grid gap-6 sm:grid-cols-2">
                {board.groups.map((g) => (
                  <div key={g.group} className="border border-line">
                    <p className="border-b border-line px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]">{g.label}</p>
                    <ol>
                      {g.lines.slice(0, 20).map((l) => (
                        <li key={l.player} className={`flex justify-between gap-3 px-4 py-2 text-sm ${l.mine ? 'bg-white/10 font-semibold' : ''}`}>
                          <span>{l.winner && board.final ? '🏆 ' : ''}#{l.rank} {l.name}</span>
                          <span>{l.value} {ch.unit}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          {entries.length === 0 && <p className="panel border border-line p-5 text-sm text-muted">Add a player to your account to take part.</p>}
          {entries.map(({ kid, attempts, pending, best }) => {
            const tier = (kid.pdr?.tier ?? 'free') as 'free' | 'standard' | 'premium'
            const check = canEnterChallenge({ state, tier, pending, published: Boolean(ch.published) })
            return (
              <div key={kid.id} className="panel border border-line p-5">
                <p className="font-display text-xl font-semibold uppercase">{kid.firstName}</p>
                <p className="text-sm text-muted">{best != null ? `Best: ${best} ${ch.unit}` : 'No counted score yet'}</p>
                {attempts.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-muted">
                    {attempts.slice(0, 5).map((a) => (
                      <li key={a.id}>{formatDate(a.createdAt, { day: 'numeric', month: 'short' })} · {STATUS[a.status] ?? a.status}{a.verifiedScore != null ? ` · ${a.verifiedScore} ${ch.unit}` : a.claimedScore != null ? ` · said ${a.claimedScore}` : ''}{a.status === 'rejected' && a.feedback ? ` — “${a.feedback}”` : ''}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-4">
                  {tier !== 'premium' && state === 'open' ? (
                    <div>
                      <p className="text-sm">Monthly challenges are part of Premium.</p>
                      <Link href={`/foundation-plus/subscribe?player=${kid.id}&plan=premium_month`} className="mt-3 inline-block bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-black">Go Premium</Link>
                    </div>
                  ) : !streamConfigured() && check.ok ? (
                    <p className="text-sm text-muted">Video uploads are being switched on — check back soon.</p>
                  ) : (
                    <SubmitForm player={kid.id} challenge={ch.id} path={path} scored unit={ch.unit} premium={false} feedbackLeft={0} canAttempt={check.ok ? null : check.reason} />
                  )}
                </div>
              </div>
            )
          })}
        </aside>
      </div>
    </div>
  )
}
