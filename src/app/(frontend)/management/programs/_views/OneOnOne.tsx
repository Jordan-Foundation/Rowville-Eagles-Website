import Link from 'next/link'
import { payload, formatMoney, formatDate } from '@/lib/payload'
import { loadTermBookingData } from '@/academy/booking-data'
import { cashPaid } from '@/academy/cancellation'
import { coachCapacity, utilisation } from '@/academy/dashboard'
import { casualSlots } from '@/academy/slots'
import { creditState, type LedgerEntry } from '@/academy/credit-ledger'
import type { Participant } from '@/payload-types'

export type Q = { term?: string; coach?: string; member?: string }
const DAY = 86_400_000
const rel = (v: number | { id: number } | null | undefined) => (v && typeof v === 'object' ? v.id : (v ?? null))

/** 1-on-1 coaching — the original Academy dashboard, unchanged. */
export async function OneOnOneView({ q }: { q: Q }) {
  const p = await payload()
  const { docs: terms } = await p.find({ pagination: false, collection: 'academy-terms', where: { status: { not_equals: 'draft' } }, sort: '-startDate', limit: 20, depth: 0 })
  const term = terms.find((t) => String(t.id) === q.term) ?? terms.find((t) => t.status === 'open') ?? terms[0]
  if (!term) return <p className="text-muted">No 1-on-1 terms yet.</p>
  const coachFilter = q.coach ? Number(q.coach) : null
  const now = new Date()

  const [{ docs: bookingsAll }, data, { docs: credits }] = await Promise.all([
    p.find({ pagination: false, collection: 'academy-bookings', where: { term: { equals: term.id }, status: { in: ['confirmed', 'payment_failed', 'completed', 'cancelled', 'refunded'] } }, depth: 1, limit: 2000, overrideAccess: true }),
    loadTermBookingData(p, term),
    p.find({ pagination: false, collection: 'academy-credits', where: { status: { in: ['active', 'pending'] } }, depth: 0, limit: 10000, overrideAccess: true, select: { account: true, sessions: true, status: true, createdAt: true, expiresAt: true } }),
  ])
  const isMember = (b: (typeof bookingsAll)[number]) => Boolean(b.participant && typeof b.participant === 'object' && (b.participant as Participant).memberships?.includes('rowville'))
  const bookings = bookingsAll.filter((b) => (!coachFilter || rel(b.coach) === coachFilter) && (!q.member || (q.member === 'club' ? isMember(b) : !isMember(b))))
  const ids = bookings.map((b) => b.id)
  const { docs: sessions } = ids.length
    ? await p.find({ pagination: false, collection: 'academy-sessions', where: { booking: { in: ids } }, depth: 0, limit: 10000, overrideAccess: true, select: { booking: true, coach: true, coverCoach: true, status: true, startsAt: true } })
    : { docs: [] }

  // Money
  const plain = (b: (typeof bookings)[number]) => ({ ...b, sessionsTotal: b.sessionsTotal ?? 1 })
  const collected = bookings.reduce((n, b) => n + cashPaid(plain(b)), 0)
  const refunded = bookings.reduce((n, b) => n + (b.refundedAmount ?? 0), 0)
  const creditUsed = bookings.reduce((n, b) => n + (b.creditSessionsUsed ?? 0), 0)
  const creditGiven = bookings.reduce((n, b) => n + (b.creditedSessions ?? 0), 0)
  const byAccount = new Map<number, LedgerEntry[]>()
  for (const c of credits) {
    const a = rel(c.account)!
    byAccount.set(a, [...(byAccount.get(a) ?? []), { id: c.id, sessions: c.sessions, status: c.status, createdAt: c.createdAt, expiresAt: c.expiresAt }])
  }
  const creditOutstanding = [...byAccount.values()].reduce((n, list) => n + creditState(list, now).available, 0)
  const creditFamilies = [...byAccount.values()].filter((list) => creditState(list, now).available > 0).length
  const overdue = bookings.filter((b) => b.status === 'payment_failed')
  const overdueAmount = overdue.reduce((n, b) => n + (b.payments ?? []).filter((x) => x.status === 'failed').reduce((m, x) => m + (x.amount ?? 0), 0), 0)
  const live = sessions.filter((s) => s.status !== 'cancelled' && s.status !== 'held')
  const cancelled = sessions.filter((s) => s.status === 'cancelled' && bookings.find((b) => b.id === rel(s.booking))?.status !== 'expired')
  const active = bookings.filter((b) => b.status !== 'cancelled' && b.status !== 'refunded')

  // Capacity & open slots per coach
  const engine = { term, coaches: data.availability, taken: data.taken, now, cutoffHours: term.bookingCutoffHours ?? 24 }
  const soon = casualSlots(engine).filter((s) => new Date(s.startsAt).getTime() < now.getTime() + 14 * DAY)
  const coachRows = data.coaches
    .filter((c) => !coachFilter || c.id === coachFilter)
    .map((c) => {
      const avail = data.availability.find((a) => a.coachId === c.id)
      const capacity = avail ? coachCapacity(term, avail) : 0
      // Sessions this coach runs: own sessions not covered by someone else, plus sessions they cover
      const runs = live.filter((s) => (rel(s.coverCoach) ?? rel(s.coach)) === c.id)
      const theirBookings = active.filter((b) => rel(b.coach) === c.id)
      return {
        id: c.id,
        name: c.name,
        capacity,
        booked: runs.length,
        util: utilisation(runs.length, capacity),
        open14: soon.filter((s) => s.coachIds.includes(c.id)).length,
        revenue: bookings.filter((b) => rel(b.coach) === c.id).reduce((n, b) => n + cashPaid(plain(b)) - (b.refundedAmount ?? 0), 0),
        cancelled: cancelled.filter((s) => rel(s.coach) === c.id).length,
        terms: theirBookings.filter((b) => b.type === 'term').length,
        casuals: theirBookings.filter((b) => b.type === 'casual').length,
      }
    })
  const capacity = coachRows.reduce((n, r) => n + r.capacity, 0)
  const booked = coachRows.reduce((n, r) => n + r.booked, 0)
  const select = 'border border-line bg-surface px-3 py-2 text-sm'
  const tiles: [string, string, string?][] = [
    ['Net revenue', formatMoney(collected - refunded), `${formatMoney(collected)} collected · ${formatMoney(refunded)} refunded`],
    ['Bookings', String(active.length), `${active.filter((b) => b.type === 'term').length} term · ${active.filter((b) => b.type === 'casual').length} casual · ${active.filter((b) => b.paymentMode === 'weekly').length} on weekly payments`],
    ['Sessions booked', `${booked} / ${capacity}`, `${utilisation(booked, capacity)}% of offered hours · ${cancelled.length} cancelled`],
    ['Open in next 14 days', String(soon.length), 'bookable times, all coaches'],
    ['Weekly payments overdue', overdue.length ? `${overdue.length} · ${formatMoney(overdueAmount)}` : '0', overdue.length ? 'see Weekly payments' : 'all on track'],
    ['Session credits', `${creditOutstanding}`, `outstanding across ${creditFamilies} famil${creditFamilies === 1 ? 'y' : 'ies'} · this term: ${creditGiven} given, ${creditUsed} used`],
  ]

  return (
      <div className="space-y-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-semibold uppercase tracking-tight">1-on-1 coaching</h2>
            <p className="mt-1 text-sm text-muted">{term.name} · {formatDate(term.startDate)} – {formatDate(term.endDate)}</p>
          </div>
          <div className="flex gap-4 text-sm">
            <Link href="/management/academy/bookings" className="underline">Bookings & cancellations</Link>
            <Link href="/management/academy#payments" className="underline">Weekly payments</Link>
            <Link href="/management/academy#cover" className="underline">Cover</Link>
          </div>
        </div>

        <form className="flex flex-wrap gap-2">
          <input type="hidden" name="program" value="1on1" />
          <select name="term" defaultValue={String(term.id)} className={select}>{terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <select name="coach" defaultValue={q.coach ?? ''} className={select}><option value="">All coaches</option>{data.coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select name="member" defaultValue={q.member ?? ''} className={select}><option value="">All players</option><option value="club">Rowville club members</option><option value="rfa">RFA-only players</option></select>
          <button className="bg-white px-4 py-2 text-sm font-semibold uppercase tracking-wider text-black">Apply</button>
        </form>
        {q.member && <p className="text-sm text-muted">Player filter applies to bookings, revenue and sessions; offered hours and open times are for all players.</p>}

        <dl className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map(([k, v, sub]) => (
            <div key={k} className="bg-surface p-5">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{k}</dt>
              <dd className="mt-2 font-display text-3xl font-semibold tabular-nums">{v}</dd>
              {sub && <dd className="mt-1 text-sm text-muted">{sub}</dd>}
            </div>
          ))}
        </dl>

        <section>
          <h2 className="font-display text-2xl font-semibold uppercase">Coaches</h2>
          <p className="mt-1 text-sm text-muted">Offered hours = each coach’s weekly times across the term, less away dates. Cover sessions count for the coach running them.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="py-3 pr-4">Coach</th><th className="pr-4">Booked / offered</th><th className="w-56 pr-4">Utilisation</th>
                  <th className="pr-4 text-right">Open next 14 days</th><th className="pr-4 text-right">Term · casual</th><th className="pr-4 text-right">Cancelled</th><th className="text-right">Net revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {coachRows.map((r) => (
                  <tr key={r.id}>
                    <td className="py-3 pr-4 font-medium">{r.name}</td>
                    <td className="pr-4 tabular-nums">{r.booked} / {r.capacity}</td>
                    <td className="pr-4">
                      <div className="flex items-center gap-3" title={`${r.name}: ${r.booked} of ${r.capacity} offered hours booked (${r.util}%)`}>
                        <div className="h-2 flex-1 bg-white/10" role="img" aria-label={`${r.util}% utilised`}>
                          <div className="h-2 rounded-r-[4px] bg-white" style={{ width: `${r.util}%` }} />
                        </div>
                        <span className="w-10 text-right tabular-nums">{r.util}%</span>
                      </div>
                    </td>
                    <td className="pr-4 text-right tabular-nums">{r.open14}</td>
                    <td className="pr-4 text-right tabular-nums">{r.terms} · {r.casuals}</td>
                    <td className="pr-4 text-right tabular-nums">{r.cancelled}</td>
                    <td className="text-right tabular-nums">{formatMoney(r.revenue)}</td>
                  </tr>
                ))}
                {coachRows.length === 0 && <tr><td colSpan={7} className="py-4 text-muted">No active coaches.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold uppercase">Open times in the next 14 days</h2>
          {soon.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              {Date.parse(term.startDate) > Date.now()
                ? `${term.name} hasn’t started yet — it starts ${formatDate(term.startDate, { weekday: 'long', day: 'numeric', month: 'long' })}.`
                : 'Nothing open in the next two weeks — every coach’s times are booked (or no availability has been set).'}
            </p>
          ) : (
            <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {soon.slice(0, 60).map((s) => (
                <li key={s.startsAt} className="border border-line px-3 py-2">
                  <span className="font-medium">{formatDate(s.startsAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                  <span className="text-muted"> · {s.coachIds.map((id) => data.coaches.find((c) => c.id === id)?.name).filter(Boolean).join(', ')}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
  )
}
