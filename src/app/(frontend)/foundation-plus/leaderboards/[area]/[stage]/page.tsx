import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { foundationGate } from '@/academy/pdr/load'
import { myPlayers, stageBoard, type Period } from '@/academy/pdr/leaderboard-data'
import { criteriaSummary } from '@/academy/pdr/content'
import { Crumbs } from '../../../ui'
import { BoardTable, Filters } from '../../Board'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Stage leaderboard', robots: { index: false } }

export default async function StageBoard({ params, searchParams }: { params: Promise<{ area: string; stage: string }>; searchParams: Promise<{ period?: string; age?: string }> }) {
  const [{ area: slug, stage: code }, sp] = await Promise.all([params, searchParams])
  const { p, settings, user } = await foundationGate()
  if (!user) redirect(`/login?next=/foundation-plus/leaderboards/${slug}/${code}`)
  const area = (await p.find({ collection: 'pdr-areas', where: { slug: { equals: slug }, hasLeaderboard: { equals: true } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
  const [lv, st] = code.split('-').map(Number)
  const stage = area && lv && st ? (await p.find({ collection: 'pdr-stages', where: { area: { equals: area.id }, levelNumber: { equals: lv }, stageNumber: { equals: st }, published: { equals: true }, scoring: { equals: 'scored' } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] : null
  if (!area || !stage) notFound()
  const period: Period = sp.period === 'month' ? 'month' : 'all'
  const age = Number(sp.age) || null
  const board = await stageBoard(p, stage, { period, birthYear: age, mine: await myPlayers(p, user.id) })
  return (
    <div>
      <Crumbs items={[{ href: '/foundation-plus', label: settings.name }, { href: '/foundation-plus/leaderboards', label: 'Leaderboards' }, { href: `/foundation-plus/leaderboards/${slug}`, label: area.name }, { label: stage.code ?? '' }]} />
      <p className="eyebrow">{stage.code}</p>
      <h1 className="mt-2 font-display text-4xl font-bold uppercase tracking-tight sm:text-5xl">{stage.skillName}</h1>
      <p className="mt-2 text-muted">{criteriaSummary(stage.criteria)} · {stage.criteria?.direction === 'lower' ? 'lowest' : 'highest'} verified score wins</p>
      <div className="mt-6"><Filters base={`/foundation-plus/leaderboards/${slug}/${code}`} period={period} age={age} years={board.years} /></div>
      <BoardTable rows={board.rows} unit={stage.criteria?.unit ?? ''} />
    </div>
  )
}
