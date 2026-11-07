import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import { hasRole } from '@/access'
import { PLANS } from '@/academy/pdr/billing/plans'
import { displayPrices } from '@/academy/pdr/billing/stripe'
import { conversionRate, memberStats, monthlyActivity } from '@/academy/pdr/billing/stats'

const aud = (n: number) => n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })
const MONTH = (k: string) => new Date(`${k}-01T00:00:00Z`).toLocaleDateString('en-AU', { month: 'short', year: '2-digit', timeZone: 'UTC' })
const EVENT_LABEL: Record<string, string> = {
  trial_started: 'Free month started', trial_converted: 'Free month → paid', trial_cancelled: 'Free month ended (not paid)', subscribed: 'Joined (paid)',
  reactivated: 'Came back', plan_changed: 'Changed plan', payment_failed: 'Payment failed', payment_recovered: 'Payment fixed', cancelled: 'Cancelled',
  grace_expired: 'Dropped to Free (unpaid)', trial_blocked: 'Second free month blocked',
}

const box: React.CSSProperties = { border: '1px solid var(--theme-elevation-150)', borderRadius: 6, padding: '14px 18px' }
const muted: React.CSSProperties = { color: 'var(--theme-elevation-600)', fontSize: 13 }
const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--theme-elevation-600)', borderBottom: '1px solid var(--theme-elevation-150)' }
const td: React.CSSProperties = { padding: '8px 12px', borderBottom: '1px solid var(--theme-elevation-100)' }

function Tile({ label, value, sub, href }: { label: string; value: string | number; sub?: string; href?: string }) {
  const inner = (
    <>
      <div style={muted}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ ...muted, marginTop: 2 }}>{sub}</div>}
    </>
  )
  return <div style={box}>{href ? <a href={href} style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</a> : inner}</div>
}

/** /admin/foundation-plus — waitlist, free months, members by plan, revenue estimate and recent activity. */
export async function FoundationPlusView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { req, permissions, visibleEntities, locale } = initPageResult
  if (!req.user) redirect('/admin/login?redirect=%2Fadmin%2Ffoundation-plus')
  const allowed = hasRole(req.user as never, 'admin', 'committee')
  const template = (children: React.ReactNode) => (
    <DefaultTemplate i18n={req.i18n} locale={locale} params={params} payload={req.payload} permissions={permissions} searchParams={searchParams} user={req.user ?? undefined} visibleEntities={visibleEntities}>
      <Gutter>{children}</Gutter>
    </DefaultTemplate>
  )
  if (!allowed) return template(<p style={{ marginTop: 24 }}>Admins only.</p>)

  const p = req.payload
  const [settings, prices, waitlist, notified, claimed, joinLinks, players, events, recent] = await Promise.all([
    p.findGlobal({ slug: 'pdr-settings', depth: 0, overrideAccess: true }),
    displayPrices(p),
    p.count({ collection: 'fplus-waitlist', overrideAccess: true }),
    p.count({ collection: 'fplus-waitlist', where: { notifiedAt: { exists: true } }, overrideAccess: true }),
    p.count({ collection: 'fplus-waitlist', where: { claimedAt: { exists: true } }, overrideAccess: true }),
    p.count({ collection: 'invite-tokens', where: { purpose: { equals: 'fplus-join' } }, overrideAccess: true }),
    p.find({ collection: 'participants', where: { 'pdr.subscriptionStatus': { exists: true } }, depth: 0, limit: 5000, overrideAccess: true, pagination: false }),
    p.find({ collection: 'fplus-events', depth: 0, limit: 10000, overrideAccess: true, pagination: false, select: { type: true, createdAt: true } }),
    p.find({ collection: 'fplus-events', depth: 1, limit: 25, sort: '-createdAt', overrideAccess: true }),
  ])
  const pct = settings.plans?.siblingDiscountPct ?? 25
  const rows = players.docs.map((d) => ({ id: d.id, account: typeof d.account === 'object' ? (d.account?.id ?? null) : (d.account ?? null), plan: d.pdr?.plan ?? null, status: d.pdr?.subscriptionStatus ?? null, cancelAtPeriodEnd: d.pdr?.cancelAtPeriodEnd }))
  const s = memberStats(rows, prices, pct)
  const ev = events.docs.map((e) => ({ type: e.type, createdAt: e.createdAt }))
  const months = monthlyActivity(ev, 6)
  const conv = conversionRate(ev)
  const count = (t: string) => ev.filter((e) => e.type === t).length
  const unsent = waitlist.totalDocs - notified.totalDocs

  return template(
    <>
      <h1 style={{ marginTop: 24 }}>{settings.programName || 'Foundation+'} dashboard</h1>
      <p style={{ ...muted, fontSize: 14, maxWidth: 820 }}>
        {settings.enabled ? '🟢 Switched on for families.' : '⚪ Switched off — the page shows “coming soon” and collects a waitlist.'} Revenue is an estimate (yearly plans counted per month, sibling
        discount applied). Exact amounts are in Stripe.
      </p>

      <h2 style={{ fontSize: 18, marginTop: 28 }}>Members now</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <Tile label="Paying members" value={s.paying} sub={s.pastDue ? `${s.pastDue} with a failed payment (in grace)` : 'all payments up to date'} />
        <Tile label="On a free month" value={s.trialing} />
        <Tile label="Est. monthly revenue" value={aud(s.mrr)} sub={`≈ ${aud(s.mrr * 12)} a year`} />
        <Tile label="Cancelling at period end" value={s.cancelling} />
        <Tile label="Free-month conversion" value={conv ? `${conv.pct}%` : '—'} sub={conv ? `${conv.converted} of ${conv.ended} finished free months` : 'no free months finished yet'} />
      </div>

      <h2 style={{ fontSize: 18, marginTop: 28 }}>By plan</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 720 }}>
        <thead><tr><th style={th}>Plan</th><th style={th}>Price</th><th style={th}>Paying</th><th style={th}>Free month</th></tr></thead>
        <tbody>
          {PLANS.map((pl) => (
            <tr key={pl.key}>
              <td style={td}>{pl.name.replace('Foundation+ ', '')} · {pl.interval === 'year' ? 'yearly' : 'monthly'}</td>
              <td style={td}>{aud(prices[pl.key])}/{pl.interval === 'year' ? 'yr' : 'mo'}</td>
              <td style={td}>{s.byPlan[pl.key].paying}</td>
              <td style={td}>{s.byPlan[pl.key].trialing || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 18, marginTop: 28 }}>Waitlist &amp; sign-ups</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <Tile label="On the waitlist" value={waitlist.totalDocs} href="/admin/collections/fplus-waitlist" />
        <Tile label="Launch email sent" value={notified.totalDocs} sub={unsent ? `${unsent} still to send${settings.enabled ? ' (sent each morning)' : ' when you switch on'}` : 'none waiting'} />
        <Tile label="Claimed their free month" value={claimed.totalDocs} sub={notified.totalDocs ? `${Math.round((claimed.totalDocs / notified.totalDocs) * 100)}% of those emailed` : undefined} />
        <Tile label="Free account links sent" value={joinLinks.totalDocs} />
        <Tile label="Second free months blocked" value={count('trial_blocked')} sub="same family or same card" />
      </div>

      <h2 style={{ fontSize: 18, marginTop: 28 }}>Last 6 months</h2>
      <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 900 }}>
        <thead><tr><th style={th}>Month</th><th style={th}>Free months started</th><th style={th}>Free month → paid</th><th style={th}>Free month ended unpaid</th><th style={th}>Joined paid</th><th style={th}>Cancelled</th></tr></thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.month}>
              <td style={td}>{MONTH(m.month)}</td><td style={td}>{m.trialsStarted}</td><td style={td}>{m.converted}</td><td style={td}>{m.trialEndedUnpaid}</td><td style={td}>{m.newPaid}</td><td style={td}>{m.cancelled}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 18, marginTop: 28 }}>Recent activity</h2>
      {recent.docs.length === 0 ? (
        <p style={muted}>Nothing yet — activity appears here as families start free months and join.</p>
      ) : (
        <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 900 }}>
          <thead><tr><th style={th}>When</th><th style={th}>What</th><th style={th}>Player</th><th style={th}>Plan</th></tr></thead>
          <tbody>
            {recent.docs.map((e) => {
              const pl = typeof e.player === 'object' && e.player ? e.player : null
              return (
                <tr key={e.id}>
                  <td style={td}>{new Date(e.createdAt).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                  <td style={td}>{EVENT_LABEL[e.type] ?? e.type}</td>
                  <td style={td}>{pl ? <a href={`/admin/collections/participants/${pl.id}`}>{pl.firstName} {pl.lastName}</a> : '—'}</td>
                  <td style={td}>{e.plan ? e.plan.replace('_month', ' monthly').replace('_year', ' yearly').replace(/^./, (c) => c.toUpperCase()) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <p style={{ ...muted, marginTop: 12 }}>
        <a href="/admin/collections/fplus-events">All activity</a> · <a href="/admin/collections/fplus-waitlist">Waitlist</a> · <a href="/admin/globals/pdr-settings">Foundation+ settings</a> · <a href="/admin/prices">Prices</a> · <a href="/admin/setup">Setup checklist</a>
      </p>
    </>,
  )
}
