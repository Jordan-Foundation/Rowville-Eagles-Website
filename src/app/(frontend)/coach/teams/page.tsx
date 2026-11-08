import Link from 'next/link'
import type { Metadata } from 'next'
import { requireCoach } from '@/academy/portal'
import { payload } from '@/lib/payload'
import { coachTeams, teamChatNew } from '@/lib/attention'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Teams', robots: { index: false } }

export default async function CoachTeams() {
  const { user } = await requireCoach('/coach/teams')
  const p = await payload()
  const teams = await coachTeams(p, user)
  const fresh = await teamChatNew(p, user, teams.map((t) => t.id))
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">Teams</h1>
        <p className="mt-3 max-w-2xl text-muted">Teams you coach or manage: notices, fixtures, training and Team Chat. A number means new Team Chat posts since you last opened that team.</p>
      </div>
      {teams.length === 0 ? (
        <p className="panel border border-line p-6 text-muted">You’re not listed as a coach on any team yet — Management adds coaches to teams in the admin (Teams).</p>
      ) : (
        <ul className="divide-y divide-line border border-line">
          {teams.map((t) => (
            <li key={t.id}>
              <Link href={`/teams/${t.slug}${fresh[t.id] ? '#team-chat' : ''}`} className="flex items-center justify-between gap-4 p-5 transition hover:bg-white/5">
                <span className="font-semibold">{t.name}</span>
                {fresh[t.id] ? (
                  <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white" aria-label={`${fresh[t.id]} new Team Chat posts`}>{fresh[t.id] > 99 ? '99+' : fresh[t.id]} new</span>
                ) : (
                  <span className="text-xs uppercase tracking-[0.15em] text-muted">Open →</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
