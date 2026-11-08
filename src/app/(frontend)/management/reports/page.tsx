import type { Metadata } from 'next'
import Link from 'next/link'
import { requireManagement } from '@/lib/management'
import { payload, formatDate } from '@/lib/payload'
import { currentSeason } from '@/lib/age-groups'
import { getAgeRules } from '@/lib/age-rules'
import { NewCycleForm } from './Forms'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Reports', robots: { index: false } }

export default async function ReportsPage() {
  await requireManagement('/management/reports')
  const p = await payload()
  const [{ docs: cycles }, { docs: programs }, { docs: teams }, rules] = await Promise.all([
    p.find({ collection: 'report-cycles', sort: '-createdAt', limit: 50, depth: 0, overrideAccess: true }),
    p.find({ collection: 'programs', where: { type: { equals: 'academy-term' }, status: { not_equals: 'closed' } }, sort: '-startDate', limit: 30, depth: 0, overrideAccess: true }),
    p.find({ collection: 'teams', where: { archived: { not_equals: true } }, sort: 'name', limit: 100, depth: 0, overrideAccess: true }),
    getAgeRules(p),
  ])
  const counts = await Promise.all(cycles.map(async (c) => {
    const [total, done] = await Promise.all([
      p.count({ collection: 'player-reports', where: { cycle: { equals: c.id } }, overrideAccess: true }),
      p.count({ collection: 'player-reports', where: { cycle: { equals: c.id }, status: { in: ['submitted', 'approved', 'released'] } }, overrideAccess: true }),
    ])
    return { total: total.totalDocs, done: done.totalDocs }
  }))

  return (
    <div className="container-x max-w-4xl py-14">
      <p className="eyebrow !text-brand">Management</p>
      <h1 className="mt-2 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">Player reports</h1>
      <p className="mt-4 text-muted">
        Start a report round, choose which programs and teams it covers, and create the reports. Each player’s report goes to the first coach listed on their group or team, at their{' '}
        <Link href="/management/curriculum" className="underline">curriculum level</Link>. Coaches get reminders 2 weeks, 1 week, 3 days and 1 day before the due date.
      </p>

      <h2 className="mt-10 font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">Report rounds</h2>
      {cycles.length === 0 ? <p className="mt-2 text-muted">None yet.</p> : (
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
          {cycles.map((c, i) => (
            <li key={c.id}>
              <Link href={`/management/reports/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 hover:bg-surface-2">
                <span><span className="font-semibold">{c.name}</span> <span className="text-sm text-muted">· due {formatDate(c.dueDate, { day: 'numeric', month: 'short', year: 'numeric' })}{c.status === 'closed' ? ' · closed' : ''}</span></span>
                <span className="text-sm">{counts[i].total ? `${counts[i].done} / ${counts[i].total} finished` : 'No reports yet'}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">New report round</h2>
      <div className="mt-3">
        <NewCycleForm
          season={currentSeason(rules.season)}
          programs={programs.map((x) => ({ id: x.id, label: x.title, hint: x.startDate ? formatDate(x.startDate, { month: 'short', year: 'numeric' }) : undefined }))}
          teams={teams.map((t) => ({ id: t.id, label: t.type === 'tournament' && t.event ? `${t.event} – ${t.name}` : t.name, hint: t.ageGroup ?? undefined }))}
        />
      </div>
    </div>
  )
}
