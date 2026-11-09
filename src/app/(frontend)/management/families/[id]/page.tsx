import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireManagement } from '@/lib/management'
import { payload, formatDate } from '@/lib/payload'
import { formatMoney } from '@/lib/format'
import { formatPhone } from '@/lib/phone'
import { birthYearOf, groupLabel } from '@/lib/age-groups'
import { accountMemberships } from '@/lib/accounts'
import { Panel, Rows } from '@/components/management/Panel'
import { ContactButtons } from '@/components/coach/ContactButtons'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Family', robots: { index: false } }

const q = { overrideAccess: true, pagination: false } as const
const day = (iso?: string | null) => (iso ? formatDate(iso, { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

/** Everything about one family account in one place. */
export default async function FamilyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireManagement('/management')
  const id = Number((await params).id)
  const p = await payload()
  const u = await p.findByID({ collection: 'users', id, depth: 0, overrideAccess: true, disableErrors: true })
  if (!u) notFound()
  const [kids, oneOnOnes, bookings, regs, teams, orders, credits, conv, tags] = await Promise.all([
    p.find({ ...q, collection: 'participants', where: { account: { equals: id } }, limit: 20, depth: 0, sort: 'firstName' }),
    p.find({ ...q, collection: 'academy-bookings', where: { account: { equals: id } }, limit: 50, depth: 1, sort: '-createdAt' }),
    p.find({ ...q, collection: 'bookings', where: { account: { equals: id } }, limit: 50, depth: 1, sort: '-createdAt' }),
    p.find({ ...q, collection: 'academy-registrations', where: { account: { equals: id } }, limit: 50, depth: 1, sort: '-createdAt' }),
    p.find({ ...q, collection: 'team-members', where: { account: { equals: id }, active: { equals: true } }, limit: 20, depth: 1 }),
    p.find({ ...q, collection: 'orders', where: { account: { equals: id } }, limit: 30, depth: 0, sort: '-createdAt' }),
    p.find({ ...q, collection: 'academy-credits', where: { account: { equals: id }, status: { equals: 'active' } }, limit: 50, depth: 0 }),
    p.find({ ...q, collection: 'conversations', where: { account: { equals: id } }, limit: 1, depth: 0 }),
    accountMemberships(p, id).catch(() => [] as string[]),
  ])
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email
  const creditSessions = credits.docs.reduce((n, c) => n + (c.sessions ?? 0), 0)
  const fplus = kids.docs.filter((k) => k.pdr?.tier && k.pdr.tier !== 'free')
  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted">Family</p>
          <h1 className="mt-1 font-display text-4xl font-semibold uppercase tracking-tight">{name}</h1>
          <p className="mt-1 text-sm text-muted">{[u.email, u.phone && formatPhone(u.phone), (u.roles ?? []).join(', ')].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ContactButtons compact name={name} phone={u.phone} />
          {conv.docs[0] && <Link href={`/management/messages/${conv.docs[0].id}`} className="inline-flex min-h-10 items-center border border-line px-3 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white">Messages</Link>}
          <Link href={`/admin/collections/users/${u.id}`} className="inline-flex min-h-10 items-center border border-line px-3 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white">Edit in admin</Link>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Account">
          <Rows rows={[
            ['Account', u.activated ? 'Activated' : 'Not activated yet'],
            ['Member of', (tags as string[]).length ? (tags as string[]).map((t) => ({ rowville: 'Rowville Eagles', rfa: 'Foundation Academy', 'foundation-plus': 'Foundation+' })[t] ?? t).join(', ') : '—'],
            ['Marketing', [u.marketingEmail ? 'email ✓' : 'email ✗', u.marketingSms ? 'texts ✓' : 'texts ✗'].join(' · ')],
            ['Texts', u.smsOptOut ? 'Turned off (replied STOP)' : 'On'],
            ['Session credits', creditSessions ? `${creditSessions} session${creditSessions === 1 ? '' : 's'}` : '—'],
            ['Joined', day(u.createdAt)],
          ]} />
        </Panel>
        <Panel title="Children" count={kids.docs.length} empty="No children added yet.">
          <ul className="divide-y divide-line">
            {kids.docs.map((k) => (
              <li key={k.id}>
                <Link href={`/management/players/${k.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-white/5">
                  <span>
                    <span className="font-semibold">{k.firstName} {k.lastName}</span>
                    {k.medical?.conditions?.trim() && <span className="ml-2 bg-red-600 px-1.5 py-0.5 text-[11px] font-bold uppercase text-white">Medical</span>}
                    <span className="block text-xs text-muted">{birthYearOf(k.dateOfBirth) ? groupLabel(birthYearOf(k.dateOfBirth)!) : ''}{k.pdr?.tier && k.pdr.tier !== 'free' ? ` · Foundation+ ${k.pdr.tier}` : ''}</span>
                  </span>
                  <span className="text-xs text-muted">Open →</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Academy terms" count={regs.docs.length} empty="No Academy term places.">
          <ul className="divide-y divide-line">
            {regs.docs.map((r) => <li key={r.id} className="px-5 py-3"><span className="font-semibold">{r.player.firstName}</span> · {typeof r.program === 'object' ? r.program.title : ''} <span className="text-muted">· {r.status}{r.reference ? ` · ${r.reference}` : ''}</span></li>)}
          </ul>
        </Panel>
        <Panel title="1-on-1s" count={oneOnOnes.docs.length} empty="No 1-on-1 bookings.">
          <ul className="divide-y divide-line">
            {oneOnOnes.docs.map((b) => (
              <li key={b.id}><Link href={`/management/academy/bookings/${b.id}`} className="block px-5 py-3 hover:bg-white/5"><span className="font-semibold">{b.player.firstName}</span> · {b.type === 'term' ? 'Term' : 'Casual'} with {typeof b.coach === 'object' ? b.coach.displayName : 'coach'} <span className="text-muted">· {b.status} · {formatMoney(b.amount)} · {b.reference}</span></Link></li>
            ))}
          </ul>
        </Panel>
        <Panel title="Camps, programs & registrations" count={bookings.docs.length} empty="No bookings.">
          <ul className="divide-y divide-line">
            {bookings.docs.map((b) => <li key={b.id}><Link href={`/admin/collections/bookings/${b.id}`} className="block px-5 py-3 hover:bg-white/5"><span className="font-semibold">{b.player?.firstName ?? b.player?.teamName}</span> · {typeof b.program === 'object' ? b.program.title : ''} <span className="text-muted">· {b.status} · {formatMoney(b.amount)} · {b.reference}</span></Link></li>)}
          </ul>
        </Panel>
        <Panel title="Teams" count={teams.docs.length} empty="Not on any team.">
          <ul className="divide-y divide-line">
            {teams.docs.map((m) => <li key={m.id} className="px-5 py-3">{typeof m.participant === 'object' ? m.participant.firstName : ''} · {typeof m.team === 'object' ? <Link href={`/teams/${m.team.slug}`} className="underline">{m.team.name}</Link> : ''}</li>)}
          </ul>
        </Panel>
        <Panel title="Shop orders" count={orders.docs.length} empty="No orders.">
          <ul className="divide-y divide-line">
            {orders.docs.map((o) => <li key={o.id}><Link href={`/admin/collections/orders/${o.id}`} className="block px-5 py-3 hover:bg-white/5">{o.reference} <span className="text-muted">· {o.status} · {formatMoney(o.total)} · {day(o.createdAt)}</span></Link></li>)}
          </ul>
        </Panel>
        <Panel title="Foundation+" count={fplus.length} empty="No Foundation+ plan.">
          <ul className="divide-y divide-line">
            {fplus.map((k) => <li key={k.id} className="px-5 py-3">{k.firstName} · {k.pdr?.tier} <span className="text-muted">· {k.pdr?.subscriptionStatus ?? ''}{k.pdr?.currentPeriodEnd ? ` · renews ${day(k.pdr.currentPeriodEnd)}` : ''}</span></li>)}
          </ul>
        </Panel>
      </div>
    </div>
  )
}
