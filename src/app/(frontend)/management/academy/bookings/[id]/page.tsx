import { PersonLink } from '@/components/management/PersonLink'
import { requireManagement } from '@/lib/management'
import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { payload, formatMoney, formatDate } from '@/lib/payload'
import { cashPaid } from '@/academy/cancellation'
import { creditStateFor } from '@/academy/credits'
import { sessionPayment } from '@/academy/session-view'
import type { AcademyCoach, AcademyTerm, User } from '@/payload-types'
import { CancelPanel, Goodwill, RetryRefund } from './CancelPanel'
import { ReschedulePanel } from './ReschedulePanel'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Booking', robots: { index: false } }

/** Money with $0 (formatMoney shows 0 as “Free”, which reads oddly here) */
const aud0 = (n: number) => (n > 0 ? formatMoney(n) : '$0')
const statusTone: Record<string, string> = { cancelled: 'text-muted line-through', completed: 'text-muted', no_show: 'text-red-300' }
const sessionLabel: Record<string, string> = { held: 'Held', scheduled: 'Booked', completed: 'Attended', no_show: 'No-show', cancelled: 'Cancelled' }

export default async function StaffBookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string; warn?: string }> }) {
  const { id } = await params
  const { done, warn } = await searchParams
  const user = await requireManagement(`/management/academy/bookings/${id}`)
  const p = await payload()
  const b = await p.findByID({ collection: 'academy-bookings', id: Number(id), depth: 1, overrideAccess: true, disableErrors: true })
  if (!b) notFound()
  const [{ docs: sessions }, { docs: coaches }] = await Promise.all([
    p.find({ pagination: false, collection: 'academy-sessions', where: { booking: { equals: b.id } }, sort: 'startsAt', limit: 100, depth: 1, overrideAccess: true }),
    p.find({ pagination: false, collection: 'academy-coaches', where: { active: { equals: true } }, limit: 100, depth: 0, sort: 'displayName', overrideAccess: true }),
  ])
  const coach = b.coach as AcademyCoach
  const term = b.term as AcademyTerm
  const account = b.account && typeof b.account === 'object' ? (b.account as User) : null
  const credits = account ? await creditStateFor(p, account.id) : null
  const now = Date.now()
  const plain = { ...b, sessionsTotal: b.sessionsTotal ?? 1 }

  return (
    <div data-brand="academy" data-page-brand="academy">
      <div className="container-x space-y-10 py-14">
        <div>
          <Link href="/management/academy/bookings" className="text-sm text-muted hover:text-ink">← Bookings</Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.3em] text-muted">{b.reference} · {b.type === 'term' ? `Term (${b.paymentMode})` : 'Casual'} · {term.name}</p>
          <h1 className="mt-2 font-display text-4xl font-semibold uppercase tracking-tight"><PersonLink kind="player" of={b.participant}>{b.player.firstName} {b.player.lastName}</PersonLink></h1>
          <p className="mt-2 text-muted">
            {coach.displayName}
            {b.type === 'term' && b.weekday ? ` · ${b.weekday}s ${b.startTime}` : ''} · <PersonLink kind="family" of={b.account}>{b.contact.firstName} {b.contact.lastName}</PersonLink> · <a href={`tel:${b.contact.mobile}`} className="underline">{b.contact.mobile}</a> · <a href={`mailto:${b.contact.email}`} className="underline">{b.contact.email}</a>
          </p>
          <p className="mt-3 inline-block border border-line px-2 py-1 text-xs font-semibold uppercase tracking-wider">{b.status.replace('_', ' ')}</p>
        </div>

        {done && (
          <div role="status" className="border-2 border-white/60 px-5 py-4 text-sm">
            <p className="font-semibold">{done}</p>
            {warn?.split('\n').map((w) => <p key={w} className="mt-1 text-amber-300">{w}</p>)}
          </div>
        )}

        <dl className="grid gap-px border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['Price', aud0(b.amount)],
            ['Credits used', `${b.creditSessionsUsed ?? 0} session${b.creditSessionsUsed === 1 ? '' : 's'}`],
            ['Paid by card', aud0(cashPaid(plain))],
            ['Refunded', aud0(b.refundedAmount ?? 0)],
            ['Credits given', `${b.creditedSessions ?? 0} session${b.creditedSessions === 1 ? '' : 's'}`],
            ['Family credit balance', credits ? `${credits.available} session${credits.available === 1 ? '' : 's'}` : '—'],
          ].map(([k, v]) => (
            <div key={k} className="bg-surface p-4">
              <dt className="text-xs uppercase tracking-wider text-muted">{k}</dt>
              <dd className="mt-1 font-display text-2xl font-semibold">{v}</dd>
            </div>
          ))}
        </dl>

        <section>
          <h2 className="font-display text-2xl font-semibold uppercase">Sessions</h2>
          <table className="mt-4 w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
              <tr><th className="py-2 pr-4">When</th><th className="pr-4">Coach</th><th className="pr-4">Status</th><th className="pr-4">Payment</th><th>Notes</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sessions.map((s) => (
                <tr key={s.id} className={statusTone[s.status] ?? ''}>
                  <td className="py-2.5 pr-4 font-medium">{formatDate(s.startsAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                  <td className="pr-4">{(s.coverCoach && typeof s.coverCoach === 'object' ? `${s.coverCoach.displayName} (cover)` : (s.coach as AcademyCoach).displayName)}</td>
                  <td className="pr-4">{sessionLabel[s.status]}{s.cancelledBy ? ` by ${s.cancelledBy}` : ''}</td>
                  <td className="pr-4">{s.status === 'cancelled' ? '—' : sessionPayment(s, b).label}</td>
                  <td className="text-muted">{[s.needsCover && 'needs cover', s.makeUpFor && 'make-up', s.cancelReason].filter(Boolean).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {['confirmed', 'payment_failed'].includes(b.status) && (
          <section className="panel border border-line p-6">
            <h2 className="font-display text-2xl font-semibold uppercase">Reschedule</h2>
            <p className="mt-1 text-sm text-muted">Move one session, or the rest of the term, to a new day or time (or coach). Price and payments don’t change.</p>
            <div className="mt-6">
              <ReschedulePanel
                bookingId={b.id}
                type={b.type}
                coachId={coach.id}
                weekday={b.weekday}
                time={b.startTime}
                coaches={coaches.map((c) => ({ id: c.id, name: c.displayName }))}
                sessions={sessions
                  .filter((s) => s.status === 'scheduled' && new Date(s.startsAt).getTime() > now)
                  .map((s) => ({ id: s.id, label: formatDate(s.startsAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) }))}
              />
            </div>
          </section>
        )}

        {['confirmed', 'payment_failed', 'completed'].includes(b.status) && (
          <section className="panel border border-line p-6">
            <h2 className="font-display text-2xl font-semibold uppercase">Cancel</h2>
            <p className="mt-1 text-sm text-muted">The policy works out what’s owed; you choose refund, credit or a make-up. Refunds go back to the family’s card through Stripe.</p>
            <div className="mt-6">
              <CancelPanel
                bookingId={b.id}
                type={b.type}
                coachId={coach.id}
                defaultTime={b.startTime}
                coaches={coaches.map((c) => ({ id: c.id, name: c.displayName }))}
                sessions={sessions
                  .filter((s) => s.status === 'scheduled')
                  .map((s) => ({
                    id: s.id,
                    label: formatDate(s.startsAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }),
                    detail: new Date(s.startsAt).getTime() > now ? sessionPayment(s, b).label : 'Already started — mark attendance instead',
                    cancellable: new Date(s.startsAt).getTime() > now,
                  }))}
              />
            </div>
          </section>
        )}

        <section className="panel border border-line p-6">
          <h2 className="font-display text-xl font-semibold uppercase">Goodwill session credits</h2>
          <p className="mt-1 text-sm text-muted">
            Give the family free 1-on-1 sessions without cancelling anything. Credits expire after 12 months.
            {credits?.nextExpiry && ` Next to expire: ${credits.nextExpiry.sessions} on ${formatDate(credits.nextExpiry.at, { day: 'numeric', month: 'short', year: 'numeric' })}.`}
          </p>
          <div className="mt-4"><Goodwill bookingId={b.id} disabled={!account} /></div>
        </section>

        {(b.adjustments?.length ?? 0) > 0 && (
          <section>
            <h2 className="font-display text-2xl font-semibold uppercase">History</h2>
            <ol className="mt-4 divide-y divide-line border border-line text-sm">
              {[...b.adjustments!].reverse().map((a) => (
                <li key={a.key} className="space-y-1 p-4">
                  <p className="font-medium">
                    {formatDate(a.at ?? '', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {a.action.replace('_', ' ')} by {a.by}
                    {a.actor && typeof a.actor === 'object' ? ` (recorded by ${a.actor.firstName || a.actor.email})` : ''}
                  </p>
                  {a.sessions && <p className="text-muted">{a.sessions}</p>}
                  <p>
                    {a.outcome === 'none'
                      ? 'No refund or credit'
                      : [
                          a.cash ? `Refund ${formatMoney(a.cash)} (${a.refundStatus})` : null,
                          a.creditSessions ? `${a.creditSessions} session credit${a.creditSessions === 1 ? '' : 's'}` : a.credit ? `Credit ${formatMoney(a.credit)}` : null,
                          a.outcome === 'makeup' ? 'Make-up booked' : null,
                        ].filter(Boolean).join(' · ')}
                  </p>
                  {a.refundStatus === 'failed' && <div className="pt-1"><RetryRefund bookingId={b.id} refundKey={a.key} /></div>}
                  <p className="text-muted">{a.rule}</p>
                  {a.reason && <p className="text-muted">Reason: {a.reason}</p>}
                  {a.error && <p className="text-red-300">Error: {a.error}</p>}
                  {a.stripeRefundIds && <p className="text-xs text-muted">Stripe: {a.stripeRefundIds}</p>}
                </li>
              ))}
            </ol>
          </section>
        )}
        <p className="text-sm"><a href={`/admin/collections/academy-bookings/${b.id}`} className="text-muted underline">Open in admin</a></p>
      </div>
    </div>
  )
}
