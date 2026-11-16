import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { hasRole } from '@/access'
import { payload, formatDate } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { coachTeams } from '@/lib/attention'
import { canSeeTeam, reflectionSettings, teamFixtureSummaries, teamUsesReflections } from '@/reflections/service'
import { ReportView } from '@/reflections/ReportView'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Match reflections', robots: { index: false } }

/** Coach: each team's recent games with who has reflected, plus the weekend reports for their teams. */
export default async function CoachReflections({ searchParams }: { searchParams: Promise<{ report?: string }> }) {
  const user = await currentUser()
  if (!user) redirect('/login?next=/coach/reflections')
  if (!hasRole(user, 'coach', 'admin', 'committee')) notFound()
  const p = await payload()
  const sp = await searchParams
  const s = await reflectionSettings(p)
  if (sp.report) {
    const r = await p.findByID({ collection: 'reflection-reports', id: Number(sp.report), depth: 0, overrideAccess: true, disableErrors: true })
    const team = r?.scopeType === 'team' ? await p.findByID({ collection: 'teams', id: Number(r.scopeKey), depth: 0, overrideAccess: true, disableErrors: true }) : null
    if (!r || !team || !canSeeTeam(user, team)) notFound()
    return <div className="space-y-6"><Link href="/coach/reflections" className="text-sm font-semibold underline">← Match reflections</Link><ReportView r={r} /></div>
  }
  const ids = (await coachTeams(p, user)).map((t) => t.id)
  const teams = ids.length ? (await p.find({ collection: 'teams', where: { id: { in: ids } }, depth: 0, limit: 50, pagination: false, overrideAccess: true })).docs.filter((t) => teamUsesReflections(t, s)) : []
  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">Match reflections</h1>
        <p className="mt-3 max-w-2xl text-muted">After each game your players pick 3 things that went well, 3 to work on, and a focus for next game. Read them, tap 👍 Seen, and add a comment if you like — families see it.</p>
      </div>
      {!teams.length && <p className="panel border border-line p-6 text-muted">{s.enabled ? 'You’re not listed as a coach on a team that uses reflections.' : 'Match reflections are switched off.'}</p>}
      {await Promise.all(teams.map(async (t) => {
        const games = await teamFixtureSummaries(p, t, user.id, s)
        const { docs: reports } = await p.find({ collection: 'reflection-reports', where: { scopeType: { equals: 'team' }, scopeKey: { equals: String(t.id) } }, sort: '-periodFrom', limit: 4, depth: 0, overrideAccess: true })
        return (
          <section key={t.id} className="space-y-3">
            <h2 className="font-display text-2xl font-bold uppercase">{t.name}</h2>
            {games.length === 0 ? <p className="text-sm text-muted">No games in the last 10 weeks.</p> : (
              <ul className="divide-y divide-line border border-line">
                {games.map((g) => (
                  <li key={g.fixture.id}>
                    <Link href={`/coach/reflections/${t.id}/${g.fixture.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-white/5" data-fixture={g.fixture.id}>
                      <span><strong>vs {g.fixture.opponent}</strong> <span className="text-muted">· {formatDate(g.fixture.startsAt, { weekday: 'short', day: 'numeric', month: 'short' })}{g.state === 'open' ? ' · open' : g.state === 'upcoming' ? ' · opens soon' : ''}</span></span>
                      <span className="flex items-center gap-3 text-sm">
                        <span>{g.submitted}/{g.expected} reflected</span>
                        {g.unseen > 0 && <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white">{g.unseen} to read</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {reports.length > 0 && <p className="text-sm">Weekend reports: {reports.map((r, i) => <span key={r.id}>{i ? ' · ' : ''}<Link className="underline" href={`/coach/reflections?report=${r.id}`}>week of {r.periodFrom}</Link></span>)}</p>}
          </section>
        )
      }))}
    </div>
  )
}
