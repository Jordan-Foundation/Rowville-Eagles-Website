import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { foundationGate } from '@/academy/pdr/load'
import { areaBoard, myPlayers, type Period } from '@/academy/pdr/leaderboard-data'
import { criteriaSummary } from '@/academy/pdr/content'
import { stageSlug } from '@/academy/pdr/report'
import { Crumbs } from '../../ui'
import { BoardTable, Filters } from '../Board'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Leaderboard', robots: { index: false } }

export default async function AreaBoard({ params, searchParams }: { params: Promise<{ area: string }>; searchParams: Promise<{ period?: string; age?: string }> }) {
  const [{ area: slug }, sp] = await Promise.all([params, searchParams])
  const { p, settings, user } = await foundationGate()
  if (!user) redirect(`/login?next=/foundation-plus/leaderboards/${slug}`)
  const area = (await p.find({ collection: 'pdr-areas', where: { slug: { equals: slug }, hasLeaderboard: { equals: true } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
  if (!area) notFound()
  const period: Period = sp.period === 'month' ? 'month' : 'all'
  const age = Number(sp.age) || null
  const [board, { docs: stages }] = await Promise.all([
    areaBoard(p, area.id, { period, birthYear: age, mine: await myPlayers(p, user.id) }),
    p.find({ collection: 'pdr-stages', where: { area: { equals: area.id }, published: { equals: true }, scoring: { equals: 'scored' } }, sort: 'sortKey', limit: 200, depth: 0, overrideAccess: true }),
  ])
  const q = new URLSearchParams({ ...(period === 'month' ? { period } : {}), ...(age ? { age: String(age) } : {}) }).toString()
  return (
    <div>
      <Crumbs items={[{ href: '/foundation-plus', label: settings.name }, { href: '/foundation-plus/leaderboards', label: 'Leaderboards' }, { label: area.name }]} />
      <h1 className="font-display text-5xl font-bold uppercase tracking-tight">{area.name}</h1>
      <div className="mt-6"><Filters base={`/foundation-plus/leaderboards/${slug}`} period={period} age={age} years={board.years} /></div>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_20rem]">
        <section>
          <h2 className="font-display text-xl font-semibold uppercase">Most stages passed{period === 'month' ? ' this month' : ''}</h2>
          <BoardTable rows={board.rows} unit="stages" />
        </section>
        <aside>
          <h2 className="font-display text-xl font-semibold uppercase">Stage leaderboards</h2>
          {stages.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Coming soon.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line border border-line">
              {stages.map((s) => (
                <li key={s.id}>
                  <Link href={`/foundation-plus/leaderboards/${slug}/${stageSlug({ levelNumber: s.levelNumber ?? 0, stageNumber: s.stageNumber })}${q ? `?${q}` : ''}`} className="block p-4 transition hover:bg-white/5">
                    <span className="block text-xs uppercase tracking-[0.2em] text-muted">{s.code}</span>
                    <span className="font-semibold">{s.skillName}</span>
                    <span className="block text-xs text-muted">{criteriaSummary(s.criteria)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  )
}
