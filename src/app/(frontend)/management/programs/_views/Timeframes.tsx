import Link from 'next/link'
import { payload, formatDate } from '@/lib/payload'
import { setupDue, setupYear } from '@/academy/yearly'
import { publishedYears } from '@/academy/yearly-setup'
import { KpiTiles } from '../_ui'

const STATUS: Record<string, string> = { draft: 'Draft', availability: 'Collecting availability', open: 'Open for bookings', closed: 'Closed' }

/** School terms and holidays: dates, coach availability deadlines and how many coaches have submitted. */
export async function TimeframesView() {
  const p = await payload()
  const now = new Date()
  const [{ docs }, coaches, years] = await Promise.all([
    p.find({ pagination: false, collection: 'academy-terms', where: { endDate: { greater_than: new Date(now.getTime() - 30 * 86_400_000).toISOString() } }, sort: 'startDate', limit: 20, depth: 0, overrideAccess: true }),
    p.count({ collection: 'academy-coaches', where: { active: { equals: true } }, overrideAccess: true }),
    publishedYears(p),
  ])
  const submitted = await Promise.all(docs.map(async (t) => (await p.count({ collection: 'academy-availability', where: { term: { equals: t.id }, submittedAt: { exists: true } }, overrideAccess: true })).totalDocs))
  const due = setupDue(now, years)
  const next = setupYear(now)
  const current = docs.find((t) => t.startDate <= now.toISOString() && now.toISOString() <= t.endDate)
  return (
    <section className="space-y-6" aria-label="Timeframes">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-3xl font-semibold uppercase">Timeframes</h2>
        <span className="flex gap-4 text-sm"><Link href={`/management/yearly-setup?year=${next}`} className="underline">Yearly setup</Link><Link href="/management/dates" className="underline">Set dates</Link></span>
      </div>
      {due && <p role="note" className="border border-amber-400/50 bg-amber-400/10 p-4 text-sm">{due} isn’t set up yet — <Link href={`/management/yearly-setup?year=${due}`} className="font-semibold underline">enter the {due} term dates</Link>.</p>}
      <KpiTiles tiles={[['Now', current?.name ?? 'Between timeframes'], ['Coming up', String(docs.filter((t) => t.startDate > now.toISOString()).length), 'terms and holidays set up'], ['Active coaches', String(coaches.totalDocs)]]} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border border-line text-sm">
          <thead><tr className="border-b border-line text-left text-muted"><th className="p-3">Timeframe</th><th className="p-3">Dates</th><th className="p-3">Status</th><th className="p-3">Availability due</th><th className="p-3">Coaches submitted</th></tr></thead>
          <tbody>
            {docs.map((t, i) => (
              <tr key={t.id} className="border-b border-line">
                <th scope="row" className="p-3 text-left"><Link href={`/admin/collections/academy-terms/${t.id}`} className="font-semibold underline-offset-4 hover:underline">{t.name}</Link><span className="block text-xs font-normal text-muted">{t.category === 'school-holidays' ? 'School holidays' : 'School term'}</span></th>
                <td className="p-3">{formatDate(t.startDate, { day: 'numeric', month: 'short' })} – {formatDate(t.endDate, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                <td className="p-3">{STATUS[t.status] ?? t.status}</td>
                <td className="p-3">{formatDate(t.availabilityDeadline, { day: 'numeric', month: 'short' })}</td>
                <td className={`p-3 ${t.status === 'availability' && submitted[i] < coaches.totalDocs ? 'text-amber-300' : ''}`}>{submitted[i]} of {coaches.totalDocs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
