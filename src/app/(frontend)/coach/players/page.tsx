import Link from 'next/link'
import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { requireCoach } from '@/academy/portal'
import { birthYearOf, groupLabel } from '@/lib/age-groups'
import { coachGroups } from '@/academy/terms/coach-groups'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Players', robots: { index: false } }

/** Find any player and open their Foundation+ player page (to view progress or mark stages as passed). */
export default async function CoachPlayers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { user, coach } = await requireCoach('/coach/players')
  const { q } = await searchParams
  const p = await payload()
  const term = (q ?? '').trim()
  // My players: everyone in my groups and teams, and my 1-on-1 players (the page opens on these)
  const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null | undefined) ?? null)
  const [groups, bookings, teams] = await Promise.all([
    coachGroups(p, coach.id),
    p.find({ pagination: false, collection: 'academy-bookings', where: { coach: { equals: coach.id }, status: { in: ['confirmed', 'completed', 'payment_failed'] } }, limit: 500, depth: 0, overrideAccess: true, select: { participant: true } }),
    p.find({ pagination: false, collection: 'teams', where: { coaches: { in: [user.id] }, archived: { not_equals: true } }, limit: 50, depth: 0, overrideAccess: true, select: { name: true } }),
  ])
  const where = new Map<number, Set<string>>()
  const add = (id: number | null, label: string) => { if (id) where.set(id, (where.get(id) ?? new Set()).add(label)) }
  for (const g of groups) for (const r of g.players) add(rel(r.participant), g.groupName ?? g.program.title)
  for (const b of bookings.docs) add(rel(b.participant), '1-on-1')
  if (teams.docs.length) {
    const { docs: members } = await p.find({ pagination: false, collection: 'team-members', where: { team: { in: teams.docs.map((t) => t.id) }, active: { equals: true } }, limit: 1000, depth: 0, overrideAccess: true, select: { participant: true, team: true } })
    for (const m of members) add(rel(m.participant), teams.docs.find((t) => t.id === rel(m.team))?.name ?? 'Team')
  }
  const myIds = [...where.keys()]
  const { docs: mine } = myIds.length ? await p.find({ pagination: false, collection: 'participants', where: { id: { in: myIds } }, sort: 'firstName', limit: myIds.length, depth: 0, overrideAccess: true }) : { docs: [] }
  const { docs } = term.length >= 2
    ? await p.find({ collection: 'participants', where: { or: [{ firstName: { like: term } }, { lastName: { like: term } }] }, sort: 'firstName', limit: 50, depth: 0, overrideAccess: true })
    : { docs: [] }
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">Players</h1>
        <p className="mt-3 text-muted">Your players — open one to see their Foundation+ page and mark stages you’ve seen them complete. Search to find anyone else.</p>
      </div>
      <form className="flex gap-2">
        <input name="q" defaultValue={term} placeholder="Search all players by name" className="w-72 border border-line bg-black/40 px-3 py-2 text-sm" />
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
                    <Link href={`/foundation-plus/${k.id}`} className="flex items-center justify-between gap-4 p-4 transition hover:bg-white/5">
                      <span>
                        <span className="font-semibold">{k.firstName} {k.lastName}</span>
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
