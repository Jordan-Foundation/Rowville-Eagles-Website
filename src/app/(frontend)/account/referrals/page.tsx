import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReferralMilestone } from '@/payload-types'
import { payload, formatDate } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { programLabel } from '@/referrals/programs'
import { maskContact, nextMilestone } from '@/referrals/rules'
import { codeFor, milestones, referralLink, referralSettings, rewardRedeemed } from '@/referrals/service'
import { ClaimForm, InviteForm, ShareLink } from './Forms'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Refer a Friend', robots: { index: false } }

const q = { overrideAccess: true, depth: 0 } as const
const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null | undefined)) ?? null
const icon = (m: Pick<ReferralMilestone, 'rewardType' | 'rewardName'>) => (m.rewardType === 'one_on_one_credit' ? '⚽' : m.rewardType === 'academy_term_credit' ? '🏆' : /bag/i.test(m.rewardName) ? '🎒' : /hood/i.test(m.rewardName) ? '🧥' : '👕')

/** Refer a Friend: the player's link, invites, progress to each reward, and rewards to claim. */
export default async function ReferralsPage({ searchParams }: { searchParams: Promise<{ player?: string }> }) {
  const user = await currentUser()
  if (!user) redirect('/login?next=/account/referrals')
  const p = await payload()
  const sp = await searchParams
  const settings = await referralSettings(p)
  const { docs: kids } = await p.find({ collection: 'participants', where: { account: { equals: user.id } }, sort: 'firstName', limit: 20, pagination: false, ...q })
  const parent = user.roles?.includes('parent')
  if (!parent || !kids.length || !settings.enabled) {
    return (
      <div className="container-x max-w-2xl py-14">
        <h1 className="font-display text-4xl font-extrabold uppercase">Refer a Friend</h1>
        <p className="mt-4 text-muted">{!settings.enabled ? 'Refer a Friend is paused at the moment.' : !parent ? 'Refer a Friend is for parent accounts.' : 'Your players appear here after your first booking — then you can start inviting friends.'}</p>
        <Link href="/account" className="mt-6 inline-block font-semibold underline">Back to my account</Link>
      </div>
    )
  }
  const kid = kids.find((k) => String(k.id) === sp.player) ?? kids[0]
  const code = await codeFor(p, kid)
  const [ms, { docs: refs }, { docs: invites }, { docs: grants }] = await Promise.all([
    milestones(p),
    p.find({ collection: 'referrals', where: { referrer: { equals: kid.id } }, sort: '-createdAt', limit: 200, pagination: false, ...q }),
    p.find({ collection: 'referral-invites', where: { referrer: { equals: kid.id } }, sort: '-createdAt', limit: 100, pagination: false, ...q }),
    p.find({ collection: 'referral-rewards', where: { participant: { equals: kid.id } }, sort: 'createdAt', limit: 50, pagination: false, depth: 1, overrideAccess: true }),
  ])
  const active = ms.filter((m) => m.active !== false).sort((a, b) => a.threshold - b.threshold)
  const confirmed = refs.filter((r) => r.status === 'confirmed').length
  const pending = refs.filter((r) => r.status === 'pending').length
  const next = nextMilestone(confirmed, active)
  const top = active.at(-1)?.threshold ?? 10
  const pct = Math.min(100, Math.round((confirmed / top) * 100))
  const refsByInvite = new Map<number, typeof refs>()
  for (const r of refs) if (rel(r.invite)) refsByInvite.set(rel(r.invite)!, [...(refsByInvite.get(rel(r.invite)!) ?? []), r])
  const viaLink = refs.filter((r) => !rel(r.invite))
  const status = (inv: (typeof invites)[number]) => {
    const list = refsByInvite.get(inv.id) ?? []
    const n = list.length > 1 ? `${list.length} players · ` : ''
    const r = list.find((x) => x.status === 'pending') ?? list.find((x) => x.status === 'confirmed') ?? list[0]
    if (list.length && list.every((x) => x.status === 'confirmed')) return { t: `${n}Confirmed ✓`, c: 'text-emerald-700' }
    if (r?.status === 'pending') return { t: `${n}Paid — counts from ${formatDate(r.confirmAfter, { day: 'numeric', month: 'short' })}`, c: 'text-amber-700' }
    if (r?.status === 'voided') return { t: 'Refunded — doesn’t count', c: 'text-muted' }
    return { t: { invited: 'Invited', signed_up: 'Signed up', trial_registered: 'Trial registered', paid: 'Paid', expired: 'Expired' }[inv.status] ?? inv.status, c: inv.status === 'expired' ? 'text-muted' : '' }
  }
  const redeemed = new Map(await Promise.all(grants.map(async (g) => [g.id, await rewardRedeemed(p, g)] as const)))
  return (
    <div className="container-x max-w-4xl py-12">
      <Link href="/account" className="text-sm text-muted hover:text-ink">← My account</Link>
      <p className="eyebrow mt-4 !text-brand">Refer a Friend</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold uppercase sm:text-5xl">Invite friends, earn rewards</h1>
      <p className="mt-3 max-w-2xl text-muted">When a new family you invite pays for an Academy term, holiday camp, Mini Ballers, a 1-on-1 or Rowville Eagles registration, it counts toward {kid.firstName}’s rewards — one for each new player. It’s confirmed once the refund window has passed.</p>

      {kids.length > 1 && (
        <nav aria-label="Players" className="mt-6 flex flex-wrap gap-2">
          {kids.map((k) => <Link key={k.id} href={`/account/referrals?player=${k.id}`} aria-current={k.id === kid.id ? 'page' : undefined} className={`rounded-full px-4 py-2 text-sm font-semibold ${k.id === kid.id ? 'bg-brand text-white' : 'border border-line'}`}>{k.firstName}</Link>)}
        </nav>
      )}

      <section aria-label="Progress" className="mt-8 rounded-2xl border border-line bg-surface-2 p-6">
        <p className="font-display text-2xl font-bold" data-headline>
          {confirmed} confirmed{next ? ` — ${next.toGo} more to your ${next.rewardName.replace(/^Free /i, 'free ')}!` : ' — every reward unlocked. Legend!'}
        </p>
        {pending > 0 && <p className="mt-1 text-sm text-muted">{pending} more paid and waiting to be confirmed.</p>}
        <div className="relative mt-8 mb-10 h-3 rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={top} aria-valuenow={confirmed} aria-label="Confirmed referrals">
          <div className="h-3 rounded-full bg-accent" style={{ width: `${pct}%` }} />
          {active.map((m) => {
            const reached = confirmed >= m.threshold
            return (
              <div key={m.id} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: `${Math.min(100, (m.threshold / top) * 100)}%` }}>
                <span className={`grid h-9 w-9 place-items-center rounded-full border-2 text-lg ${reached ? 'border-accent bg-accent' : 'border-line bg-surface grayscale'}`} aria-hidden>{icon(m)}</span>
                <span className={`absolute top-10 w-14 text-[10px] leading-tight sm:w-20 sm:text-[11px] ${m.threshold === top ? 'right-0 text-right' : 'left-1/2 -translate-x-1/2'} ${reached ? 'font-semibold' : 'text-muted'}`}>{m.threshold} · {m.rewardName.replace(/^Free /i, '').replace(/ session$/, '')}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section aria-label="Your link" className="mt-8">
        <h2 className="font-display text-2xl font-bold uppercase">{kid.firstName}’s link</h2>
        <p className="mt-1 text-sm text-muted">Share it anywhere — or give friends the code <strong className="text-ink" data-code>{code}</strong> to enter at checkout.</p>
        <div className="mt-3"><ShareLink link={referralLink(code)} text="Come and play at Rowville — have a look:" /></div>
      </section>

      <section aria-label="Invite a friend" className="mt-10 rounded-2xl border border-line p-6">
        <h2 className="font-display text-2xl font-bold uppercase">Invite a friend</h2>
        <p className="mt-1 text-sm text-muted">Pop in their details and what you think they’d enjoy, then send them the link yourself. Their page shows your pick first.</p>
        <div className="mt-4"><InviteForm players={kids.map((k) => ({ id: k.id, firstName: k.firstName }))} current={kid.id} /></div>
      </section>

      <section aria-label="Families you’ve invited" className="mt-10">
        <h2 className="font-display text-2xl font-bold uppercase">Families you’ve invited</h2>
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
          {invites.map((inv) => {
            const st = status(inv)
            return (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <span><span className="font-semibold">{inv.inviteeName || maskContact(inv.inviteeEmail, inv.inviteePhone) || 'A friend'}</span> <span className="text-muted">· {programLabel(inv.featured)} · {formatDate(inv.createdAt, { day: 'numeric', month: 'short' })}</span></span>
                <span className={`font-semibold ${st.c}`}>{st.t}</span>
              </li>
            )
          })}
          {viaLink.map((r) => (
            <li key={`r${r.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <span><span className="font-semibold">A family using your link</span> <span className="text-muted">· {programLabel(r.program)}</span></span>
              <span className={`font-semibold ${r.status === 'confirmed' ? 'text-emerald-700' : r.status === 'pending' ? 'text-amber-700' : 'text-muted'}`}>{r.status === 'confirmed' ? 'Confirmed ✓' : r.status === 'pending' ? `Paid — counts from ${formatDate(r.confirmAfter, { day: 'numeric', month: 'short' })}` : 'Refunded — doesn’t count'}</span>
            </li>
          ))}
          {!invites.length && !viaLink.length && <li className="p-4 text-sm text-muted">No invites yet — make your first link above.</li>}
        </ul>
      </section>

      <section aria-label="Rewards" className="mt-10">
        <h2 className="font-display text-2xl font-bold uppercase">Rewards</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {active.map((m) => {
            const g = grants.find((x) => rel(x.milestone) === m.id)
            const sizes = (m.sizes ?? '').split(',').map((x) => x.trim()).filter(Boolean)
            return (
              <li key={m.id} className={`rounded-2xl border p-5 ${g ? 'border-accent' : 'border-line opacity-70'}`} data-reward={m.threshold}>
                <p className="text-2xl" aria-hidden>{icon(m)}</p>
                <p className="mt-1 font-semibold">{m.rewardName}</p>
                <p className="text-xs text-muted">{m.threshold} confirmed referrals</p>
                <div className="mt-3 text-sm">
                  {!g ? <span className="text-muted">{Math.max(0, m.threshold - confirmed)} to go</span>
                    : g.status === 'held' ? <span className="text-muted">Unlocked — we’ll be in touch</span>
                    : m.rewardType === 'physical_item' ? (g.status === 'unlocked' ? <ClaimForm grant={g.id} sizes={sizes} /> : g.status === 'claimed' ? <span className="font-semibold">Claimed{g.size ? ` (${g.size})` : ''} — we’ll let you know when it’s ready</span> : <span className="font-semibold text-emerald-700">Handed over ✓</span>)
                    : m.rewardType === 'one_on_one_credit' ? <span className="font-semibold">Added to your account — used automatically on your next 1-on-1</span>
                    : redeemed.get(g.id) ? <span className="font-semibold text-emerald-700">Used ✓</span> : <span className="font-semibold">Ready — taken off automatically when you register for an Academy term</span>}
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
