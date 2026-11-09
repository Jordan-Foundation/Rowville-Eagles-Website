import { PersonLink } from '@/components/management/PersonLink'
import { markSeen } from '@/lib/seen'
import { requireManagement } from '@/lib/management'
import Link from 'next/link'
import type { Metadata } from 'next'
import type { Where } from 'payload'
import { redirect } from 'next/navigation'
import { payload, formatMoney, formatDate } from '@/lib/payload'
import type { AcademyCoach, Participant } from '@/payload-types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '1-on-1 bookings', robots: { index: false } }

type Q = { q?: string; status?: string; term?: string; coach?: string; type?: string; member?: string }
const statuses = ['confirmed', 'payment_failed', 'completed', 'cancelled', 'refunded', 'expired', 'held']

export default async function StaffBookingsPage({ searchParams }: { searchParams: Promise<Q> }) {
  const user = await requireManagement('/management/academy/bookings')
  void markSeen(await payload(), user.id, 'bookings')
  const q = await searchParams
  const p = await payload()
  const [{ docs: terms }, { docs: coaches }] = await Promise.all([
    p.find({ pagination: false, collection: 'academy-terms', sort: '-startDate', limit: 20, depth: 0 }),
    p.find({ pagination: false, collection: 'academy-coaches', sort: 'displayName', limit: 100, depth: 0, overrideAccess: true }),
  ])
  const and: Where[] = []
  if (q.q?.trim()) {
    const t = q.q.trim()
    and.push({ or: [{ reference: { like: t } }, { 'contact.email': { like: t } }, { 'contact.lastName': { like: t } }, { 'player.firstName': { like: t } }, { 'player.lastName': { like: t } }] })
  }
  if (q.status) and.push({ status: { equals: q.status } })
  else and.push({ status: { not_in: ['expired', 'held'] } })
  if (q.term) and.push({ term: { equals: Number(q.term) } })
  if (q.coach) and.push({ coach: { equals: Number(q.coach) } })
  if (q.type) and.push({ type: { equals: q.type } })
  const { docs } = await p.find({ pagination: false, collection: 'academy-bookings', where: { and }, sort: '-createdAt', limit: 200, depth: 1, overrideAccess: true })
  // Club members (Rowville registered players) vs RFA-only players
  const rows = docs.filter((b) => {
    if (!q.member) return true
    const member = Boolean(b.participant && typeof b.participant === 'object' && (b.participant as Participant).memberships?.includes('rowville'))
    return q.member === 'club' ? member : !member
  })
  const select = 'border border-line bg-surface px-3 py-2 text-sm'

  return (
    <div data-brand="academy" data-page-brand="academy">
      <div className="container-x space-y-8 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Management · Foundation Academy</p>
            <h1 className="mt-2 font-display text-4xl font-semibold uppercase tracking-tight">1-on-1 bookings</h1>
          </div>
          <div className="flex gap-4 text-sm"><Link href="/management/programs" className="underline">Programs Overview</Link><Link href="/management/academy" className="underline">Availability & cover</Link></div>
        </div>
        <form className="flex flex-wrap gap-2">
          <input name="q" defaultValue={q.q} placeholder="Reference, family or player" className={`${select} min-w-56 flex-1`} />
          <select name="status" defaultValue={q.status ?? ''} className={select}><option value="">Active & past</option>{statuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select>
          <select name="term" defaultValue={q.term ?? ''} className={select}><option value="">All terms</option>{terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <select name="coach" defaultValue={q.coach ?? ''} className={select}><option value="">All coaches</option>{coaches.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}</select>
          <select name="type" defaultValue={q.type ?? ''} className={select}><option value="">Casual & term</option><option value="casual">Casual</option><option value="term">Term</option></select>
          <select name="member" defaultValue={q.member ?? ''} className={select}><option value="">All players</option><option value="club">Rowville club members</option><option value="rfa">RFA-only players</option></select>
          <button className="bg-white px-4 py-2 text-sm font-semibold uppercase tracking-wider text-black">Filter</button>
        </form>
        <p className="text-sm text-muted">{rows.length} booking{rows.length === 1 ? '' : 's'}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
              <tr><th className="py-3 pr-4">Booking</th><th className="pr-4">Player / family</th><th className="pr-4">Coach</th><th className="pr-4">First session</th><th className="pr-4">Price</th><th>Status</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((b) => (
                <tr key={b.id} className="hover:bg-white/5">
                  <td className="py-3 pr-4"><Link href={`/management/academy/bookings/${b.id}`} className="font-mono font-medium underline">{b.reference}</Link><span className="block text-xs text-muted">{b.type === 'term' ? `Term · ${b.paymentMode}` : 'Casual'}</span></td>
                  <td className="pr-4"><PersonLink kind="player" of={b.participant}>{b.player.firstName} {b.player.lastName}</PersonLink><span className="block text-xs text-muted"><PersonLink kind="family" of={b.account}>{b.contact.firstName} {b.contact.lastName}</PersonLink> · {b.contact.email}</span></td>
                  <td className="pr-4">{(b.coach as AcademyCoach).displayName}</td>
                  <td className="pr-4">{b.firstSessionAt ? formatDate(b.firstSessionAt, { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}</td>
                  <td className="pr-4">{formatMoney(b.amount)}{(b.refundedAmount ?? 0) > 0 && <span className="block text-xs text-muted">−{formatMoney(b.refundedAmount!)} refunded</span>}</td>
                  <td className={b.status === 'payment_failed' ? 'text-red-300' : ''}>{b.status.replace('_', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
