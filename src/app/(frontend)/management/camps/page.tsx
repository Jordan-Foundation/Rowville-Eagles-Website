import Link from 'next/link'
import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { payload } from '@/lib/payload'
import { campDayLabel, campDayList } from '@/lib/camps'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Holiday camps', robots: { index: false } }

/** Every holiday camp, soonest first: children booked and how many groups. */
export default async function CampsPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  await requireManagement('/management/camps')
  const all = (await searchParams).all === '1'
  const p = await payload()
  const { docs } = await p.find({ pagination: false, collection: 'programs', where: { type: { equals: 'holiday-camp' }, ...(all ? {} : { status: { in: ['open', 'full', 'draft'] } }) }, sort: 'startDate', limit: 100, depth: 0, overrideAccess: true })
  const rows = await Promise.all(docs.map(async (c) => {
    const [kids, groups] = await Promise.all([
      p.count({ collection: 'bookings', where: { program: { equals: c.id }, status: { equals: 'paid' } }, overrideAccess: true }),
      p.find({ pagination: false, collection: 'camp-placements', where: { program: { equals: c.id } }, limit: 2000, depth: 0, overrideAccess: true, select: { group: true } }),
    ])
    const days = campDayList(c)
    return { c, kids: kids.totalDocs, groups: new Set(groups.docs.map((g) => g.group)).size, days }
  }))
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Holiday camps</h1>
        <p className="mt-2 text-muted">Open a camp to see its age groups and who’s coming each day. <Link href={all ? '/management/camps' : '/management/camps?all=1'} className="underline">{all ? 'Hide closed camps' : 'Show closed camps too'}</Link></p>
      </div>
      <ul className="divide-y divide-line border border-line">
        {rows.map(({ c, kids, groups, days }) => (
          <li key={c.id}>
            <Link href={`/management/camps/${c.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-white/5">
              <span>
                <span className="font-semibold">{c.title}</span>
                <span className="block text-sm text-muted">{days.length ? `${campDayLabel(days[0].date)} – ${campDayLabel(days.at(-1)!.date)} · ${days.length} day${days.length === 1 ? '' : 's'}` : 'No dates yet'}</span>
              </span>
              <span className="text-sm text-muted">{kids} child{kids === 1 ? '' : 'ren'} · {groups} group{groups === 1 ? '' : 's'} · {c.status}</span>
            </Link>
          </li>
        ))}
        {rows.length === 0 && <li className="p-4 text-sm text-muted">No holiday camps yet — add one in Program setup.</li>}
      </ul>
    </div>
  )
}
