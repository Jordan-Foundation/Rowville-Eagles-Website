import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { foundationGate } from '@/academy/pdr/load'
import { Crumbs } from '../ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Leaderboards', robots: { index: false } }

export default async function Leaderboards() {
  const { p, settings, user } = await foundationGate()
  if (!user) redirect('/login?next=/foundation-plus/leaderboards')
  const { docs: areas } = await p.find({ collection: 'pdr-areas', where: { hasLeaderboard: { equals: true } }, sort: 'order', depth: 0, limit: 20, overrideAccess: true })
  return (
    <div>
      <Crumbs items={[{ href: '/foundation-plus', label: settings.name }, { label: 'Leaderboards' }]} />
      <h1 className="font-display text-5xl font-bold uppercase tracking-tight">Leaderboards</h1>
      <p className="mt-2 max-w-2xl text-muted">Scores checked by Academy coaches only. Players show as first name and last initial — parents can hide their child from the report page.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {areas.map((a) => (
          <Link key={a.id} href={`/foundation-plus/leaderboards/${a.slug}`} className="panel gloss-sheen block border border-line p-6 transition hover:border-white/40" style={{ borderTop: `3px solid ${a.colour || '#fff'}` }}>
            <p className="font-display text-2xl font-semibold uppercase">{a.name}</p>
            <p className="mt-1 text-sm text-muted">Stages passed + every scored stage →</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
