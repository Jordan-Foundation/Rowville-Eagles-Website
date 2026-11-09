import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireManagement } from '@/lib/management'
import { payload, formatDate } from '@/lib/payload'
import { formatPhone } from '@/lib/phone'
import { birthYearOf, groupLabel } from '@/lib/age-groups'
import { Panel, Rows } from '@/components/management/Panel'
import { MedicalBadge } from '@/components/coach/ContactButtons'
import { statusLabel } from '@/academy/reports/rules'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Player', robots: { index: false } }

const q = { overrideAccess: true, pagination: false } as const
const day = (iso?: string | null) => (iso ? formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—')

/** Everything about one player in one place: family, medical, groups, teams, 1-on-1s, reports, attendance. */
export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireManagement('/management')
  const id = Number((await params).id)
  const p = await payload()
  const k = await p.findByID({ collection: 'participants', id, depth: 1, overrideAccess: true, disableErrors: true })
  if (!k) notFound()
  const parent = typeof k.account === 'object' ? k.account : null
  const [regs, members, bookings, sessions, reports, clubBookings] = await Promise.all([
    p.find({ ...q, collection: 'academy-registrations', where: { participant: { equals: id } }, limit: 30, depth: 1, sort: '-createdAt' }),
    p.find({ ...q, collection: 'team-members', where: { participant: { equals: id } }, limit: 20, depth: 1 }),
    p.find({ ...q, collection: 'academy-bookings', where: { participant: { equals: id } }, limit: 50, depth: 1, sort: '-createdAt' }),
    p.find({ ...q, collection: 'academy-sessions', where: { 'booking.participant': { equals: id } }, limit: 200, depth: 0, sort: '-startsAt' }).catch(() => ({ docs: [] as { status: string }[] })),
    p.find({ ...q, collection: 'player-reports', where: { participant: { equals: id } }, limit: 30, depth: 1, sort: '-createdAt' }),
    p.find({ ...q, collection: 'bookings', where: { participant: { equals: id } }, limit: 30, depth: 1, sort: '-createdAt' }),
  ])
  // Group / team attendance: training-attendance rows whose roster includes this player
  const rosterIds = [...regs.docs.map((r) => r.id), ...members.docs.map((m) => m.id)]
  const keys = [...regs.docs.map((r) => (typeof r.slot === 'object' && r.slot ? r.slot.id : r.slot)).filter(Boolean).map((s) => ({ slot: { equals: s } })), ...members.docs.map((m) => ({ team: { equals: typeof m.team === 'object' ? m.team.id : m.team } }))]
  const att = keys.length ? (await p.find({ ...q, collection: 'training-attendance', where: { or: keys }, limit: 500, depth: 0 })).docs : []
  const attended = att.filter((a) => Array.isArray(a.present) && (a.present as number[]).some((x) => rosterIds.includes(x))).length
  const by = birthYearOf(k.dateOfBirth)
  const oneDone = sessions.docs.filter((s) => s.status === 'completed').length
  const oneMissed = sessions.docs.filter((s) => s.status === 'no_show').length
  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted">Player</p>
          <h1 className="mt-1 font-display text-4xl font-semibold uppercase tracking-tight">{k.firstName} {k.lastName}</h1>
          <p className="mt-1 text-sm text-muted">Born {day(k.dateOfBirth)}{by ? ` · ${groupLabel(by)}` : ''}{parent ? <> · Family <Link href={`/management/families/${parent.id}`} className="underline">{[parent.firstName, parent.lastName].filter(Boolean).join(' ') || parent.email}</Link></> : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/foundation-plus/${k.id}`} className="inline-flex min-h-10 items-center border border-line px-3 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white">Foundation+ page</Link>
          <Link href={`/admin/collections/participants/${k.id}`} className="inline-flex min-h-10 items-center border border-line px-3 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white">Edit in admin</Link>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Health & safety">
          <div className="px-5 py-3"><MedicalBadge note={k.medical?.conditions} /></div>
          <Rows rows={[
            ['Emergency', k.medical?.emergencyContact ? `${k.medical.emergencyContact}${k.medical.emergencyPhone ? ` · ${formatPhone(k.medical.emergencyPhone)}` : ''}` : '—'],
            ['Photos', k.photoConsent ? 'OK to use' : 'No photos'],
            ['Parent', parent ? `${[parent.firstName, parent.lastName].filter(Boolean).join(' ')} · ${parent.phone ? formatPhone(parent.phone) : parent.email}` : '—'],
          ]} />
        </Panel>
        <Panel title="Attendance">
          <Rows rows={[
            ['Group & team', att.length ? `${attended} of ${att.length} marked trainings` : 'Nothing marked yet'],
            ['1-on-1s', sessions.docs.length ? `${oneDone} attended · ${oneMissed} no-show · ${sessions.docs.length} booked` : '—'],
            ['Foundation+', k.pdr?.tier && k.pdr.tier !== 'free' ? `${k.pdr.tier} (${k.pdr.subscriptionStatus ?? 'active'})` : 'Free'],
          ]} />
        </Panel>
        <Panel title="Academy groups" count={regs.docs.length} empty="Not in an Academy term group.">
          <ul className="divide-y divide-line">{regs.docs.map((r) => <li key={r.id} className="px-5 py-3">{typeof r.program === 'object' ? r.program.title : ''} <span className="text-muted">· {r.status}{typeof r.slot === 'object' && r.slot ? ` · ${r.slot.weekday} ${r.slot.startTime}` : ''}</span></li>)}</ul>
        </Panel>
        <Panel title="Teams" count={members.docs.length} empty="Not on a team.">
          <ul className="divide-y divide-line">{members.docs.map((m) => <li key={m.id} className="px-5 py-3">{typeof m.team === 'object' ? <Link href={`/teams/${m.team.slug}`} className="underline">{m.team.name}</Link> : ''} <span className="text-muted">{m.active ? '' : '· left'}</span></li>)}</ul>
        </Panel>
        <Panel title="1-on-1 bookings" count={bookings.docs.length} empty="No 1-on-1s.">
          <ul className="divide-y divide-line">{bookings.docs.map((b) => <li key={b.id}><Link href={`/management/academy/bookings/${b.id}`} className="block px-5 py-3 hover:bg-white/5">{b.type === 'term' ? 'Term' : 'Casual'} with {typeof b.coach === 'object' ? b.coach.displayName : 'coach'} <span className="text-muted">· {b.status} · {b.reference}</span></Link></li>)}</ul>
        </Panel>
        <Panel title="Camps & programs" count={clubBookings.docs.length} empty="No camp or program bookings.">
          <ul className="divide-y divide-line">{clubBookings.docs.map((b) => <li key={b.id} className="px-5 py-3">{typeof b.program === 'object' ? b.program.title : ''} <span className="text-muted">· {b.status} · {b.reference}</span></li>)}</ul>
        </Panel>
        <Panel title="Player reports" count={reports.docs.length} empty="No reports yet.">
          <ul className="divide-y divide-line">{reports.docs.map((r) => <li key={r.id}><Link href={`/management/reports/r/${r.id}`} className="block px-5 py-3 hover:bg-white/5">{typeof r.cycle === 'object' ? r.cycle.name : 'Report'} <span className="text-muted">· {statusLabel(r.status)}</span></Link></li>)}</ul>
        </Panel>
      </div>
    </div>
  )
}
