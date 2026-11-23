import Link from 'next/link'
import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { requireCoach } from '@/academy/portal'
import { birthYearOf, groupLabel } from '@/lib/age-groups'
import { coachPlayerMap } from '@/academy/coach-players'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Players', robots: { index: false } }

/** Find any player and open their Foundation+ player page (to view progress or mark stages as passed). */
export default async function CoachPlayers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { user, coach } = await requireCoach('/coach/players')
  const { q } = await searchParams
  const p = await payload()
  const term = (q ?? '').trim()
  // My players: everyone in my groups and teams, and my 1-on-1 / small group players
  const { where } = await coachPlayerMap(p, coach, user)
  const myIds = [...where.keys()]
  const { docs: mine } = myIds.length ? await p.find({ pagination: false, collection: 'participants', where: { id: { in: myIds } }, sort: 'firstName', limit: myIds.length, depth: 0, overrideAccess: true }) : { docs: [] }
  const { docs } = term.length >= 2
    ? await p.find({ collection: 'participants', where: { or: [{ firstName: { like: term } }, { lastName: { like: term } }] }, sort: 'firstName', limit: 50, depth: 0, overrideAccess: true })
    : { docs: [] }
  const shirts = await (await import('@/numbers/service')).numbersFor(p, [...mine, ...docs].map((k) => k.id))
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">Players</h1>
        <p className="mt-3 text-muted">Your players — open one for their contacts, sessions, summaries, reports and goals (and a link to their Foundation+ page). Search to find anyone else on Foundation+.</p>
      </div>
      <form className="flex gap-2">
        <input name="q" type="search" aria-label="Search all players by name" defaultValue={term} placeholder="Search all players by name" className="w-72 border border-line bg-black/40 px-3 py-2 text-sm" />
        <button className="bg-white px-4 py-2 text-sm font-semibold text-black">Search</button>
      </form>
      {term.length < 2 && (
        <section>
          <h2 className="font-display text-xl font-semibold uppercase">My players ({mine.length})</h2>
          {mine.length === 0 ? <p className="mt-3 text-muted">No players in your groups, teams or 1-on-1s yet.</p> : (
            <ul className="mt-4 divide-y divide-line border border-line">
              {mine.map((k) => {
                const by = birthYearOf(k.dateOfBirth)
                return (
                  <li key={k.id}>
                    <Link href={`/coach/players/${k.id}`} className="flex items-center justify-between gap-4 p-4 transition hover:bg-white/5" data-player={`${k.firstName} ${k.lastName}`}>
                      <span>
                        <span className="font-semibold">{shirts.get(k.id) ? <span className="mr-2 text-muted">#{shirts.get(k.id)}</span> : null}{k.firstName} {k.lastName}</span>
                        {k.medical?.conditions?.trim() && <span className="ml-2 bg-red-600 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">Medical</span>}
                        <span className="block text-xs text-muted">{[...(where.get(k.id) ?? [])].join(' · ')}</span>
                      </span>
                      <span className="text-sm text-muted">{by ? groupLabel(by) : ''} →</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
      {term.length >= 2 && (docs.length === 0 ? <p className="text-muted">No players found.</p> : (
        <ul className="divide-y divide-line border border-line">
          {docs.map((k) => {
            const by = birthYearOf(k.dateOfBirth)
            return (
              <li key={k.id}><Link href={`/foundation-plus/${k.id}`} className="flex justify-between p-4 transition hover:bg-white/5"><span className="font-semibold">{k.firstName} {k.lastName}</span><span className="text-sm text-muted">{by ? groupLabel(by) : ''} →</span></Link></li>
            )
          })}
        </ul>
      ))}
    </div>
  )
}
