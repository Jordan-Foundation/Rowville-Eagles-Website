import { payload, formatAUD, formatDate } from '@/lib/payload'
import { PLANS } from '@/academy/pdr/billing/plans'
import { displayPrices } from '@/academy/pdr/billing/stripe'
import { conversionRate, memberStats, monthlyActivity } from '@/academy/pdr/billing/stats'
import type { Participant } from '@/payload-types'
import { Heading, KpiTiles, thCls } from '../_ui'

const EVENT_LABEL: Record<string, string> = {
  trial_started: 'Free month started', trial_converted: 'Free month → paid', trial_cancelled: 'Free month ended (not paid)', subscribed: 'Joined (paid)',
  reactivated: 'Came back', plan_changed: 'Changed plan', payment_failed: 'Payment failed', payment_recovered: 'Payment fixed', cancelled: 'Cancelled',
  grace_expired: 'Dropped to Free (unpaid)', trial_blocked: 'Second free month blocked',
}
const MONTH = (k: string) => new Date(`${k}-01T00:00:00Z`).toLocaleDateString('en-AU', { month: 'short', year: '2-digit', timeZone: 'UTC' })

/** Foundation+ members, free months, conversion and revenue (moved here from the admin dashboard). */
export async function FoundationPlusView() {
  const p = await payload()
  const [settings, prices, waitlist, notified, claimed, players, events, recent] = await Promise.all([
    p.findGlobal({ slug: 'pdr-settings', depth: 0, overrideAccess: true }),
    displayPrices(p),
    p.count({ collection: 'fplus-waitlist', overrideAccess: true }),
    p.count({ collection: 'fplus-waitlist', where: { notifiedAt: { exists: true } }, overrideAccess: true }),
    p.count({ collection: 'fplus-waitlist', where: { claimedAt: { exists: true } }, overrideAccess: true }),
    p.find({ collection: 'participants', where: { 'pdr.subscriptionStatus': { exists: true } }, depth: 0, limit: 5000, overrideAccess: true, pagination: false }),
    p.find({ collection: 'fplus-events', depth: 0, limit: 10000, overrideAccess: true, pagination: false, select: { type: true, createdAt: true } }),
    p.find({ collection: 'fplus-events', depth: 1, limit: 15, sort: '-createdAt', overrideAccess: true }),
  ])
  const rows = players.docs.map((d) => ({ id: d.id, account: typeof d.account === 'object' ? (d.account?.id ?? null) : (d.account ?? null), plan: d.pdr?.plan ?? null, status: d.pdr?.subscriptionStatus ?? null, cancelAtPeriodEnd: d.pdr?.cancelAtPeriodEnd }))
  const s = memberStats(rows, prices, settings.plans?.siblingDiscountPct ?? 25)
  const ev = events.docs.map((e) => ({ type: e.type, createdAt: e.createdAt }))
  const conv = conversionRate(ev)
  const months = monthlyActivity(ev, 6)
  const cancels = ev.filter((e) => e.type === 'cancelled' || e.type === 'grace_expired').length
  const tiles: [string, string, string?][] = [
    ['Active members', String(s.paying), s.pastDue ? `${s.pastDue} with a failed payment (in grace)` : 'all payments up to date'],
    ['On a free month', String(s.trialing), `${waitlist.totalDocs} on the waitlist · ${claimed.totalDocs} claimed`],
    ['Free month → paid', conv ? `${conv.pct}%` : '—', conv ? `${conv.converted} of ${conv.ended} finished free months` : 'no free months finished yet'],
    ['Cancellations', String(cancels), `${s.cancelling} cancelling at period end`],
    ['Monthly revenue (est.)', formatAUD(s.mrr), `≈ ${formatAUD(s.mrr * 12)} a year`],
    ['Launch emails', `${notified.totalDocs} / ${waitlist.totalDocs}`, settings.enabled ? 'Foundation+ is on' : 'sent when you switch Foundation+ on'],
  ]
  return (
    <div className="space-y-10">
      <Heading title={settings.programName || 'Foundation+'} sub={settings.enabled ? 'Switched on for families' : 'Switched off — collecting a waitlist'} links={[{ href: '/admin/globals/pdr-settings', label: 'Foundation+ settings' }, { href: '/admin/collections/fplus-events', label: 'All activity' }]} />
      <KpiTiles tiles={tiles} />
      <section className="grid gap-10 lg:grid-cols-2">
        <div>
          <h3 className="font-display text-2xl font-semibold uppercase">By plan</h3>
          <table className="mt-4 w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-muted"><tr><th className={thCls}>Plan</th><th className={thCls}>Price</th><th className={thCls}>Paying</th><th className={thCls}>Free month</th></tr></thead>
            <tbody className="divide-y divide-line">
              {PLANS.map((pl) => (
                <tr key={pl.key}><td className="py-3 pr-4">{pl.name.replace('Foundation+ ', '')} · {pl.interval === 'year' ? 'yearly' : 'monthly'}</td><td className="pr-4">{formatAUD(prices[pl.key])}</td><td className="pr-4 tabular-nums">{s.byPlan[pl.key].paying}</td><td className="tabular-nums">{s.byPlan[pl.key].trialing || '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="font-display text-2xl font-semibold uppercase">Last 6 months</h3>
          <table className="mt-4 w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-muted"><tr><th className={thCls}>Month</th><th className={thCls}>Free months</th><th className={thCls}>→ paid</th><th className={thCls}>Joined</th><th className={thCls}>Cancelled</th></tr></thead>
            <tbody className="divide-y divide-line">
              {months.map((m) => <tr key={m.month}><td className="py-3 pr-4">{MONTH(m.month)}</td><td className="pr-4 tabular-nums">{m.trialsStarted}</td><td className="pr-4 tabular-nums">{m.converted}</td><td className="pr-4 tabular-nums">{m.newPaid}</td><td className="tabular-nums">{m.cancelled}</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h3 className="font-display text-2xl font-semibold uppercase">Recent activity</h3>
        {recent.docs.length === 0 ? <p className="mt-3 text-sm text-muted">Nothing yet.</p> : (
          <ul className="mt-4 divide-y divide-line border border-line text-sm">
            {recent.docs.map((e) => {
              const kid = typeof e.player === 'object' ? (e.player as Participant | null) : null
              return <li key={e.id} className="flex flex-wrap justify-between gap-3 px-4 py-3"><span>{EVENT_LABEL[e.type] ?? e.type}{kid ? ` · ${kid.firstName} ${kid.lastName}` : ''}</span><span className="text-muted">{formatDate(e.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span></li>
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
