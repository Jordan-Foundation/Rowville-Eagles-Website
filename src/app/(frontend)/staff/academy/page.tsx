import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { payload, formatDate } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { hasRole } from '@/access'
import { daysUntil } from '@/academy/reminders'
import { RunButton } from './RunButton'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Academy availability', robots: { index: false } }

const kindLabel: Record<string, string> = { '14d': '2 wk', '7d': '1 wk', '3d': '3 days', '1d': '1 day' }

export default async function StaffAcademyPage() {
  const user = await currentUser()
  if (!user || !hasRole(user, 'admin', 'committee')) redirect('/login?next=/staff/academy')
  const p = await payload()
  const [{ docs: terms }, { docs: coaches }] = await Promise.all([
    p.find({ collection: 'academy-terms', where: { status: { in: ['availability', 'open'] } }, sort: 'startDate', depth: 0, limit: 10 }),
    p.find({ collection: 'academy-coaches', depth: 1, limit: 200, sort: 'displayName', overrideAccess: true }),
  ])
  const [{ docs: avail }, { docs: log }] = await Promise.all([
    p.find({ collection: 'academy-availability', where: { term: { in: terms.map((t) => t.id) } }, depth: 0, limit: 1000, overrideAccess: true }),
    p.find({ collection: 'academy-reminder-log', where: { term: { in: terms.map((t) => t.id) } }, depth: 0, limit: 5000, overrideAccess: true }),
  ])
  const id = (v: number | { id: number }) => (typeof v === 'object' ? v.id : v)

  return (
    <div data-brand="academy" data-page-brand="academy">
      <div className="container-x space-y-12 py-14">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Staff · Foundation Academy</p>
          <h1 className="mt-2 font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">Coach availability</h1>
          <p className="mt-3 max-w-2xl text-muted">
            Reminders go out automatically every morning — 2 weeks, 1 week, 3 days and 1 day before each deadline — to coaches who haven’t submitted.
            Each coach gets each reminder once, and they stop as soon as the coach submits.
          </p>
          <div className="mt-6"><RunButton /></div>
        </div>

        {terms.length === 0 && <p className="text-muted">No terms are collecting availability.</p>}
        {terms.map((term) => {
          const left = daysUntil(new Date(term.availabilityDeadline), new Date())
          const rows = coaches.map((c) => {
            const a = avail.find((x) => id(x.term) === term.id && id(x.coach) === c.id)
            const order = Object.keys(kindLabel)
            const sent = log
              .filter((l) => id(l.term) === term.id && id(l.coach) === c.id)
              .sort((x, y) => order.indexOf(x.kind) - order.indexOf(y.kind))
              .map((l) => kindLabel[l.kind])
            return { c, a, sent }
          })
          const done = rows.filter((r) => r.a?.submittedAt).length
          return (
            <section key={term.id}>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2 className="font-display text-2xl font-semibold uppercase">{term.name}</h2>
                <p className="text-sm text-muted">
                  Due {formatDate(term.availabilityDeadline, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  {left > 0 ? ` · ${left} day${left === 1 ? '' : 's'} left` : left === 0 ? ' · due today' : ' · deadline passed'} · {done}/{rows.length} submitted
                </p>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
                    <tr><th className="py-3 pr-4">Coach</th><th className="pr-4">Status</th><th className="pr-4">Slots</th><th className="pr-4">Away</th><th>Reminders sent</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map(({ c, a, sent }) => (
                      <tr key={c.id}>
                        <td className="py-3 pr-4">
                          <span className="font-medium">{c.displayName}</span>
                          {!c.active && <span className="ml-2 text-xs text-muted">(hidden)</span>}
                          <span className="block text-xs text-muted">{typeof c.user === 'object' ? c.user.email : ''}</span>
                        </td>
                        <td className="pr-4">{a?.submittedAt ? <span className="bg-white px-2 py-0.5 text-xs font-semibold text-black">Submitted {formatDate(a.submittedAt, { day: 'numeric', month: 'short' })}</span> : <span className="text-red-300">Not submitted</span>}</td>
                        <td className="pr-4">{a?.slots?.length ?? 0}</td>
                        <td className="pr-4">{a?.awayPeriods?.length ? a.awayPeriods.map((w) => `${formatDate(w.from, { day: 'numeric', month: 'short' })}–${formatDate(w.to, { day: 'numeric', month: 'short' })}`).join(', ') : '—'}</td>
                        <td className="text-muted">{sent.length ? sent.join(', ') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
