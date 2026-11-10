import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireManagement } from '@/lib/management'
import { payload } from '@/lib/payload'
import { campDayLabel, campHoursLabel } from '@/lib/camps'
import { loadCampGroups, regroupCamp } from '@/camps/groups'
import { DownloadCsv } from '@/components/management/DownloadCsv'
import { CampBoard } from './CampBoard'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Holiday camp', robots: { index: false } }

/** One holiday camp: its age groups (drag and drop to change) and who's coming each day. */
export default async function CampPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireManagement(`/management/camps/${id}`)
  const p = await payload()
  const camp = await p.findByID({ collection: 'programs', id: Number(id), depth: 0, overrideAccess: true, disableErrors: true })
  if (!camp || camp.type !== 'holiday-camp') notFound()
  let data = await loadCampGroups(p, camp)
  // Bookings paid before grouping existed (or a missed update): place them now
  if (data.unplaced > 0) {
    await regroupCamp(p, camp.id)
    data = await loadCampGroups(p, camp)
  }
  const dayNames = Object.fromEntries(data.days.map((d) => [d.date, campDayLabel(d.date).split(' ')[0]]))
  return (
    <div className="space-y-8">
      <div>
        <Link href="/management/camps" className="text-sm text-muted hover:text-ink">← Holiday camps</Link>
        <h1 className="mt-2 font-display text-4xl font-semibold uppercase tracking-tight">{camp.title}</h1>
        <p className="mt-2 text-muted">
          {data.days.length ? `${campDayLabel(data.days[0].date)} – ${campDayLabel(data.days.at(-1)!.date)} · ${campHoursLabel(data.days[0])}` : 'No camp days set'} · {camp.status}
        </p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href={`/management/programs/setup/${camp.id}`} className="underline">Camp setup</Link>
          <Link href={`/programs/${camp.slug}`} className="underline">Public page</Link>
          <Link href={`/admin/collections/programs/${camp.id}`} className="text-muted underline">Camp days &amp; prices (admin)</Link>
        </p>
        <div className="mt-3"><DownloadCsv list="bookings" params={{ program: camp.id }} label="Download bookings (CSV)" /></div>
      </div>

      <dl className="panel grid gap-x-8 gap-y-3 border border-line p-5 text-sm sm:grid-cols-3">
        <div><dt className="text-muted">Children booked</dt><dd className="font-display text-2xl font-semibold">{data.children}</dd></div>
        <div><dt className="text-muted">Groups</dt><dd className="font-display text-2xl font-semibold">{data.groups.length}</dd></div>
        <div><dt className="text-muted">Group size</dt><dd className="font-semibold">{data.rules.min}–{data.rules.max} children</dd></div>
      </dl>

      <section>
        <h2 className="font-display text-2xl font-semibold uppercase">Each day</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[32rem] border border-line text-sm">
            <thead><tr className="border-b border-line text-left text-muted"><th className="p-3">Day</th><th className="p-3">Children</th><th className="p-3">Groups that day</th></tr></thead>
            <tbody>
              {data.perDay.map((d) => (
                <tr key={d.date} className="border-b border-line align-top">
                  <th scope="row" className="p-3 text-left font-semibold">{campDayLabel(d.date)}</th>
                  <td className="p-3">{d.total}{camp.capacity ? <span className="text-muted"> of {camp.capacity}</span> : null}</td>
                  <td className="p-3">{d.groups.length ? d.groups.map((g) => `${g.label} (${g.kids})`).join(' · ') : <span className="text-muted">Nobody yet</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">A group with fewer than {data.rules.min} children on a day joins its nearest age group for that day. Children keep their own group on the other days.</p>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold uppercase">Age groups</h2>
        {data.groups.length === 0 ? (
          <p className="mt-3 border border-line p-4 text-sm text-muted">No children booked yet — groups appear as bookings are paid.</p>
        ) : (
          <div className="mt-3"><CampBoard campId={camp.id} groups={data.groups} dayNames={dayNames} totalDays={data.days.length} /></div>
        )}
      </section>
    </div>
  )
}
