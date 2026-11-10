import { PersonLink } from '@/components/management/PersonLink'
import { requireManagement } from '@/lib/management'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { payload, formatMoney, formatDate } from '@/lib/payload'
import { daysUntil } from '@/academy/reminders'
import { RunButton } from './RunButton'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Academy availability', robots: { index: false } }

const kindLabel: Record<string, string> = { '14d': '2 wk', '7d': '1 wk', '3d': '3 days', '1d': '1 day' }

export default async function StaffAcademyPage() {
  const user = await requireManagement('/management/academy')
  const p = await payload()
  const [{ docs: terms }, { docs: coaches }] = await Promise.all([
    p.find({ pagination: false, collection: 'academy-terms', where: { status: { in: ['availability', 'open'] } }, sort: 'startDate', depth: 0, limit: 10 }),
    p.find({ pagination: false, collection: 'academy-coaches', depth: 1, limit: 200, sort: 'displayName', overrideAccess: true }),
  ])
  const [{ docs: avail }, { docs: log }] = await Promise.all([
    p.find({ pagination: false, collection: 'academy-availability', where: { term: { in: terms.map((t) => t.id) } }, depth: 0, limit: 1000, overrideAccess: true }),
    p.find({ pagination: false, collection: 'academy-reminder-log', where: { term: { in: terms.map((t) => t.id) } }, depth: 0, limit: 5000, overrideAccess: true }),
  ])
  const id = (v: number | { id: number }) => (typeof v === 'object' ? v.id : v)
  const { docs: cover } = await p.find({
    collection: 'academy-sessions',
    where: { needsCover: { equals: true }, status: { in: ['held', 'scheduled'] }, startsAt: { greater_than: new Date().toISOString() } },
    sort: 'startsAt',
    depth: 1,
    limit: 200,
    overrideAccess: true,
  })
  const { docs: weekly } = await p.find({
    collection: 'academy-bookings',
    where: { paymentMode: { equals: 'weekly' }, status: { in: ['confirmed', 'payment_failed'] } },
    sort: 'nextChargeAt',
    depth: 1,
    limit: 300,
    overrideAccess: true,
  })
  const overdue = weekly.filter((b) => b.status === 'payment_failed')
  const onTrack = weekly.filter((b) => b.status !== 'payment_failed' && (b.sessionsPaid ?? 0) < (b.sessionsTotal ?? 0))

  return (
    <div data-brand="academy" data-page-brand="academy">
      <div className="container-x space-y-12 py-14">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Management · Foundation Academy</p>
          <h1 className="mt-2 font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">Coach availability</h1>
          <p className="mt-3 max-w-2xl text-muted">
            Reminders go out automatically every morning — 2 weeks, 1 week, 3 days and 1 day before each deadline — to coaches who haven’t submitted.
            Each coach gets each reminder once, and they stop as soon as the coach submits.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4"><RunButton /><a href="/management/programs" className="text-sm underline">Programs Overview</a><a href="/management/academy/terms" className="text-sm underline">Academy terms</a><a href="/management/academy/bookings" className="text-sm underline">Bookings & cancellations</a></div>
        </div>

        <section id="cover" className="scroll-mt-24">
          <h2 className="font-display text-2xl font-semibold uppercase">Sessions needing cover</h2>
          {cover.length === 0 ? (
            <p className="mt-3 text-sm text-muted">None — every upcoming session has its booked coach.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
                  <tr><th className="py-3 pr-4">When</th><th className="pr-4">Booked coach (away)</th><th className="pr-4">Player</th><th className="pr-4">Cover coach</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {cover.filter((s) => s.kind !== 'group-player').map((s) => {
                    const b = typeof s.booking === 'object' ? s.booking : null
                    const c = typeof s.coach === 'object' ? s.coach : null
                    const cc = s.coverCoach && typeof s.coverCoach === 'object' ? s.coverCoach : null
                    return (
                      <tr key={s.id}>
                        <td className="py-3 pr-4 font-medium">{formatDate(s.startsAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                        <td className="pr-4">{c?.displayName}</td>
                        <td className="pr-4">{s.kind === 'group-slot' ? 'Small group' : b ? `${b.player.firstName} ${b.player.lastName}` : '—'}</td>
                        <td className="pr-4">{cc ? cc.displayName : <span className="text-red-300">Not assigned</span>}</td>
                        <td><a href={s.kind === 'group-slot' && s.group ? `/management/academy/groups/${typeof s.group === 'object' ? s.group.id : s.group}` : `/admin/collections/academy-sessions/${s.id}`} className="underline">Assign →</a></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section id="payments" className="scroll-mt-24">
          <h2 className="font-display text-2xl font-semibold uppercase">Weekly payments</h2>
          <p className="mt-2 text-sm text-muted">
            {overdue.length} overdue · {onTrack.length} on track. Stripe retries failed cards automatically and the family is emailed a link to pay; a booking returns to on-track by itself when the payment goes through.
          </p>
          {weekly.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
                  <tr><th className="py-3 pr-4">Family</th><th className="pr-4">Coach</th><th className="pr-4">Paid</th><th className="pr-4">Status</th><th className="pr-4">Next charge</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...overdue, ...onTrack].map((b) => {
                    const owed = (b.payments ?? []).filter((x) => x.status === 'failed').reduce((n, x) => n + (x.amount ?? 0), 0)
                    return (
                      <tr key={b.id}>
                        <td className="py-3 pr-4">
                          <PersonLink kind="player" of={b.participant} className="font-medium">{b.player.firstName} {b.player.lastName}</PersonLink>
                          <span className="block text-xs text-muted"><PersonLink kind="family" of={b.account}>{b.contact.firstName} {b.contact.lastName}</PersonLink> · {b.contact.mobile} · {b.reference}</span>
                        </td>
                        <td className="pr-4">{typeof b.coach === 'object' ? b.coach.displayName : ''}</td>
                        <td className="pr-4">{b.sessionsPaid ?? 0} of {b.sessionsTotal}</td>
                        <td className="pr-4">{b.status === 'payment_failed' ? <span className="text-red-300">Overdue {formatMoney(owed)}</span> : 'On track'}</td>
                        <td className="pr-4">{b.nextChargeAt ? formatDate(b.nextChargeAt, { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}</td>
                        <td><a href={`/management/academy/bookings/${b.id}`} className="underline">Open →</a></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

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
