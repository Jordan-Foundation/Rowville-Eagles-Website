import Link from 'next/link'
import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { requireCoach } from '@/academy/portal'
import { birthYearOf, groupLabel } from '@/lib/age-groups'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Players', robots: { index: false } }

/** Find any player and open their Foundation+ report (to view progress or mark stages as passed). */
export default async function CoachPlayers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireCoach('/coach/players')
  const { q } = await searchParams
  const p = await payload()
  const term = (q ?? '').trim()
  const { docs } = term.length >= 2
    ? await p.find({ collection: 'participants', where: { or: [{ firstName: { like: term } }, { lastName: { like: term } }] }, sort: 'firstName', limit: 50, depth: 0, overrideAccess: true })
    : { docs: [] }
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">Players</h1>
        <p className="mt-3 text-muted">Search for a player to open their Foundation+ report and mark stages you’ve seen them complete.</p>
      </div>
      <form className="flex gap-2">
        <input name="q" defaultValue={term} placeholder="First or last name" className="w-72 border border-line bg-black/40 px-3 py-2 text-sm" />
        <button className="bg-white px-4 py-2 text-sm font-semibold text-black">Search</button>
      </form>
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
