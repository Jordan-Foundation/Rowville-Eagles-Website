import Link from 'next/link'
import { payload } from '@/lib/payload'
import { campDayLabel, campDayList } from '@/lib/camps'
import { campStaffing } from '@/camps/staffing'
import { KpiTiles } from '../_ui'

/** Holiday camps at a glance: children, groups, coaches needed vs confirmed, children per day. */
export async function CampsView() {
  const p = await payload()
  const today = new Date().toISOString().slice(0, 10)
  const { docs } = await p.find({ pagination: false, collection: 'programs', where: { type: { equals: 'holiday-camp' }, status: { in: ['open', 'full', 'draft'] } }, sort: 'startDate', limit: 30, depth: 0, overrideAccess: true })
  const camps = (await Promise.all(docs.map(async (c) => {
    const days = campDayList(c)
    if ((days.at(-1)?.date ?? '9999') < today) return null
    const s = await campStaffing(p, c)
    return { c, days, s }
  }))).filter((x): x is NonNullable<typeof x> => !!x)
  const kids = camps.reduce((n, x) => n + x.s.groups.children, 0)
  const short = camps.reduce((n, x) => n + x.s.gap.short, 0)
  const waiting = camps.reduce((n, x) => n + x.s.invited.length, 0)
  return (
    <section className="space-y-6" aria-label="Holiday camps">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-3xl font-semibold uppercase">Holiday camps</h2>
        <Link href="/management/camps" className="text-sm underline">All camps →</Link>
      </div>
      <KpiTiles tiles={[['Upcoming camps', String(camps.length)], ['Children booked', String(kids)], ['Coaches still needed', String(short), waiting ? `${waiting} waiting for an answer` : 'none waiting']]} />
      {camps.length === 0 && <p className="border border-line p-5 text-sm text-muted">No upcoming camps — add one in Program setup.</p>}
      <ul className="space-y-4">
        {camps.map(({ c, days, s }) => (
          <li key={c.id} className="panel border border-line p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <Link href={`/management/camps/${c.id}`} className="font-display text-xl font-semibold uppercase underline-offset-4 hover:underline">{c.title}</Link>
              <span className="text-sm text-muted">{days.length ? `${campDayLabel(days[0].date)} – ${campDayLabel(days.at(-1)!.date)}` : 'No days set'} · {c.status}</span>
            </div>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
              <div><dt className="text-muted">Children</dt><dd className="font-semibold">{s.groups.children}</dd></div>
              <div><dt className="text-muted">Groups</dt><dd className="font-semibold">{s.groups.groups.length}</dd></div>
              <div><dt className="text-muted">Coaches</dt><dd className={`font-semibold ${s.gap.short ? 'text-amber-300' : ''}`}>{s.confirmed.length} of {s.needed} confirmed{s.invited.length ? ` · ${s.invited.length} waiting` : ''}</dd></div>
              <div><dt className="text-muted">Per day</dt><dd className="font-semibold">{s.groups.perDay.map((d) => `${campDayLabel(d.date).split(' ')[0]} ${d.total}`).join(' · ') || '—'}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  )
}
