import Link from 'next/link'
import type { Metadata } from 'next'
import type { Where } from 'payload'
import { requireManagement } from '@/lib/management'
import { payload, formatDate } from '@/lib/payload'
import { REFERRAL_PROGRAMS, programLabel } from '@/referrals/programs'
import { referralOverride, rewardAction } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Referrals', robots: { index: false } }

const q = { overrideAccess: true } as const
const name = (v: unknown) => (v && typeof v === 'object' ? `${(v as { firstName?: string }).firstName ?? ''} ${(v as { lastName?: string }).lastName ?? ''}`.trim() : '—')
const btn = 'min-h-9 border border-line px-3 text-xs font-semibold uppercase tracking-[0.1em]'
const input = 'min-h-9 border border-line bg-surface px-2 text-sm'
const STATUS: Record<string, string> = { pending: 'Pending', confirmed: 'Confirmed', voided: 'Voided' }

/** Refer a Friend: every referral (with overrides), the rewards queue, settings and simple stats. */
export default async function ReferralsAdmin({ searchParams }: { searchParams: Promise<{ tab?: string; status?: string; program?: string; q?: string; done?: string; error?: string }> }) {
  await requireManagement('/management/referrals')
  const sp = await searchParams
  const p = await payload()
  const tab = sp.tab === 'rewards' ? 'rewards' : 'referrals'
  const [invites, signedUp, confirmedAll, pendingAll, toFulfil] = await Promise.all([
    p.count({ collection: 'referral-invites', ...q }),
    p.count({ collection: 'referral-invites', where: { status: { in: ['signed_up', 'trial_registered', 'paid'] } }, ...q }),
    p.find({ collection: 'referrals', where: { status: { equals: 'confirmed' } }, limit: 5000, pagination: false, depth: 1, ...q }),
    p.count({ collection: 'referrals', where: { status: { equals: 'pending' } }, ...q }),
    p.count({ collection: 'referral-rewards', where: { status: { in: ['claimed', 'held'] } }, ...q }),
  ])
  const top = [...confirmedAll.docs.reduce((m, r) => m.set(name(r.referrer), (m.get(name(r.referrer)) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const tabCls = (on: boolean) => `min-h-10 border px-3 py-2 text-sm ${on ? 'border-white bg-white text-black' : 'border-line text-muted hover:text-ink'}`
  const qs = new URLSearchParams(Object.entries({ status: sp.status ?? '', program: sp.program ?? '', q: sp.q ?? '' }).filter(([, v]) => v)).toString()

  let body: React.ReactNode
  if (tab === 'rewards') {
    const { docs } = await p.find({ collection: 'referral-rewards', where: { status: { in: ['claimed', 'held', 'unlocked', 'fulfilled'] } }, sort: '-updatedAt', limit: 200, pagination: false, depth: 1, ...q })
    const order = { claimed: 0, held: 1, unlocked: 2, fulfilled: 3 } as Record<string, number>
    body = (
      <section aria-label="Rewards" className="panel border border-line">
        <ul className="divide-y divide-line">
          {[...docs].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9)).map((g) => {
            const m = typeof g.milestone === 'object' ? g.milestone : null
            return (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm" data-grant={g.id}>
                <span><span className="font-semibold">{m?.rewardName}</span>{g.size ? ` · size ${g.size}` : ''} <span className="text-muted">· {name(g.participant)} · unlocked {formatDate(g.createdAt, { day: 'numeric', month: 'short' })}{g.note ? ` · ${g.note}` : ''}</span></span>
                <span className="flex items-center gap-2">
                  <span className={g.status === 'claimed' || g.status === 'held' ? 'font-semibold text-amber-300' : 'text-muted'}>{({ claimed: 'Claimed — to hand over', held: 'On hold — check', unlocked: m?.rewardType === 'physical_item' ? 'Waiting for the family to claim' : 'Credit issued', fulfilled: 'Handed over' } as Record<string, string>)[g.status] ?? g.status}</span>
                  {g.status === 'claimed' && <form action={rewardAction}><input type="hidden" name="id" value={g.id} /><button name="do" value="fulfil" className={btn}>Mark handed over</button></form>}
                  {g.status === 'held' && <form action={rewardAction}><input type="hidden" name="id" value={g.id} /><button name="do" value="release" className={btn}>Release</button></form>}
                </span>
              </li>
            )
          })}
          {!docs.length && <li className="p-4 text-sm text-muted">No rewards unlocked yet.</li>}
        </ul>
      </section>
    )
  } else {
    const where: Where = { and: [
      ...(sp.status ? [{ status: { equals: sp.status } }] : []),
      ...(sp.program ? [{ program: { equals: sp.program } }] : []),
      ...(sp.q ? [{ or: [{ reference: { like: sp.q } }, { 'referrer.firstName': { like: sp.q } }, { 'referrer.lastName': { like: sp.q } }, { 'referrer.referralCode': { like: sp.q.toUpperCase() } }] }] : []),
    ] }
    const { docs } = await p.find({ collection: 'referrals', where, sort: '-createdAt', limit: 200, pagination: false, depth: 1, ...q })
    body = (
      <>
        <form className="flex flex-wrap items-end gap-2 text-sm">
          <label>Status<select name="status" defaultValue={sp.status ?? ''} className={`${input} mt-1 block`}><option value="">All</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Program<select name="program" defaultValue={sp.program ?? ''} className={`${input} mt-1 block`}><option value="">All</option>{REFERRAL_PROGRAMS.map((x) => <option key={x.value} value={x.value}>{x.short}</option>)}</select></label>
          <label>Referrer or reference<input name="q" defaultValue={sp.q ?? ''} className={`${input} mt-1 block`} /></label>
          <button className={btn}>Filter</button>
        </form>
        <section aria-label="Referrals" className="panel border border-line">
          <ul className="divide-y divide-line">
            {docs.map((r) => (
              <li key={r.id} className="space-y-2 p-4 text-sm" data-ref={r.reference}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <span><span className="font-semibold">{name(r.referrer)}</span> referred <span className="font-semibold">{name(r.referred)}</span><span className="block text-muted">{programLabel(r.program)} · {r.reference} · {r.attribution === 'code' ? 'code' : r.attribution === 'invite_match' ? 'matched an invite' : 'set by Management'} · paid {formatDate(r.paidAt, { day: 'numeric', month: 'short' })}{r.status === 'pending' ? ` · counts from ${formatDate(r.confirmAfter, { day: 'numeric', month: 'short' })}` : ''}</span></span>
                  <span className={r.status === 'confirmed' ? 'font-semibold text-emerald-300' : r.status === 'pending' ? 'font-semibold text-amber-300' : 'text-muted'}>{STATUS[r.status]}</span>
                </div>
                {r.reviewFlag && <p className="text-amber-300">⚠ {r.reviewFlag}</p>}
                <details>
                  <summary className="cursor-pointer text-xs text-muted">Change…</summary>
                  <form action={referralOverride} className="mt-2 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={r.id} /><input type="hidden" name="qs" value={qs} />
                    <label className="text-xs">Note (why)<input name="note" required className={`${input} mt-1 block`} /></label>
                    <label className="text-xs">Code (to reassign)<input name="code" className={`${input} mt-1 block w-32`} /></label>
                    {r.status !== 'confirmed' && <button name="do" value="confirm" className={btn}>Confirm</button>}
                    {r.status !== 'voided' && <button name="do" value="void" className={btn}>Void</button>}
                    <button name="do" value="reassign" className={btn}>Reassign</button>
                    {r.reviewFlag && <button name="do" value="clear" className={btn}>Keep counting</button>}
                  </form>
                  {(r.history ?? []).length > 0 && <ul className="mt-2 text-xs text-muted">{(r.history ?? []).map((h, i) => <li key={i}>{h.at ? formatDate(h.at, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''} — {h.action}{h.note ? `: ${h.note}` : ''}</li>)}</ul>}
                </details>
              </li>
            ))}
            {!docs.length && <li className="p-4 text-sm text-muted">No referrals yet.</li>}
          </ul>
        </section>
      </>
    )
  }
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Referrals</h1>
        <p className="mt-2 max-w-3xl text-muted">Refer a Friend: families share their player’s link; a new player’s first paid Academy term, camp, Mini Ballers, 1-on-1 or Rowville Eagles registration counts once the refund window has passed. <Link href="/admin/globals/referral-settings" className="underline">Settings</Link> · <Link href="/admin/collections/referral-milestones" className="underline">Rewards (milestones)</Link></p>
      </div>
      {(sp.done || sp.error) && <p role={sp.error ? 'alert' : 'status'} className={`border p-4 text-sm ${sp.error ? 'border-red-400/40 text-red-200' : 'border-emerald-400/40 text-emerald-200'}`}>{sp.error ?? sp.done}</p>}
      <dl className="panel grid gap-4 border border-line p-5 text-sm sm:grid-cols-5">
        <div><dt className="text-muted">Invite links made</dt><dd className="font-display text-2xl font-semibold">{invites.totalDocs}</dd></div>
        <div><dt className="text-muted">Signed up</dt><dd className="font-display text-2xl font-semibold">{signedUp.totalDocs}</dd></div>
        <div><dt className="text-muted">Pending</dt><dd className="font-display text-2xl font-semibold">{pendingAll.totalDocs}</dd></div>
        <div><dt className="text-muted">Confirmed</dt><dd className="font-display text-2xl font-semibold">{confirmedAll.docs.length}</dd></div>
        <div><dt className="text-muted">Top referrers</dt><dd className="text-xs">{top.length ? top.map(([n, c]) => `${n} (${c})`).join(', ') : '—'}</dd></div>
      </dl>
      <nav aria-label="Referrals" className="flex flex-wrap gap-2">
        <Link href="/management/referrals" className={tabCls(tab === 'referrals')}>Referrals</Link>
        <Link href="/management/referrals?tab=rewards" className={tabCls(tab === 'rewards')}>Rewards{toFulfil.totalDocs ? ` (${toFulfil.totalDocs} to do)` : ''}</Link>
      </nav>
      {body}
    </div>
  )
}
