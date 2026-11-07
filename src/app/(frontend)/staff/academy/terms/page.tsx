import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { payload, formatAUD, formatDate } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { hasRole } from '@/access'
import { groupLabel } from '@/lib/age-groups'
import { programSlots, slotTaken } from '@/academy/terms/service'
import { slotLabel, spotsLeft, upcomingSessions, yearsLabel } from '@/academy/terms/slots'
import type { AcademyRegistration } from '@/payload-types'
import { CancelForm, OfferForm } from './Forms'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Academy terms', robots: { index: false } }

const statusLabel: Record<AcademyRegistration['status'], string> = { interest: 'Interest', offered: 'Offered', pending_payment: 'Paying now / unpaid', paid: 'Paid', cancelled: 'Cancelled' }
const rel = (v: number | { id: number } | null | undefined) => (v && typeof v === 'object' ? v.id : (v ?? null))

export default async function StaffTermsPage({ searchParams }: { searchParams: Promise<{ program?: string }> }) {
  const user = await currentUser()
  if (!user || !hasRole(user, 'admin', 'committee')) redirect('/login?next=/staff/academy/terms')
  const { program: programParam } = await searchParams
  const p = await payload()
  const { docs: programs } = await p.find({ collection: 'programs', where: { type: { equals: 'academy-term' } }, sort: '-startDate', limit: 30, depth: 0, overrideAccess: true })
  const program = programs.find((x) => String(x.id) === programParam) ?? programs.find((x) => x.status === 'open') ?? programs[0]
  if (!program) return <div className="container-x py-14"><p>No Academy term programs yet — create one in the admin (Programs → type “Academy term”).</p></div>

  const [slots, taken, { docs: regs }] = await Promise.all([
    programSlots(p, program.id),
    slotTaken(p, program.id),
    p.find({ collection: 'academy-registrations', where: { program: { equals: program.id }, status: { not_equals: 'cancelled' } }, sort: 'player.lastName', limit: 2000, depth: 0, overrideAccess: true }),
  ])
  const unplaced = regs.filter((r) => r.status === 'interest' || (r.status === 'offered' && !r.slot))
  const bySlot = new Map<number, AcademyRegistration[]>()
  for (const r of regs) if (r.slot && r.status !== 'interest') bySlot.set(rel(r.slot)!, [...(bySlot.get(rel(r.slot)!) ?? []), r])
  const options = (by: number | null | undefined) => slots.map((s) => ({ id: s.id, label: `${slotLabel(s)} · ${yearsLabel(s.birthYears)} · ${spotsLeft(s, taken.get(s.id) ?? 0) ?? '∞'} left`, fits: by ? (s.birthYears ?? []).includes(by) : false }))
  const who = (r: AcademyRegistration) => `${r.player.firstName} ${r.player.lastName}`
  const by = (r: AcademyRegistration) => r.playingBirthYear ?? r.birthYear

  return (
    <div className="container-x py-14">
      <Link href="/staff/academy" className="text-sm text-muted hover:text-ink">← Academy</Link>
      <h1 className="mt-4 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">Academy terms</h1>
      <nav className="mt-4 flex flex-wrap gap-2">
        {programs.map((x) => (
          <Link key={x.id} href={`/staff/academy/terms?program=${x.id}`} className={`rounded-full border px-3 py-1 text-sm ${x.id === program.id ? 'border-brand bg-brand text-white' : 'border-line'}`}>{x.title}</Link>
        ))}
      </nav>
      <p className="mt-4 text-sm text-muted">
        {program.startDate && program.endDate ? `${formatDate(program.startDate, { day: 'numeric', month: 'short' })} – ${formatDate(program.endDate, { day: 'numeric', month: 'short', year: 'numeric' })} · ` : ''}
        {formatAUD(program.price)} · {regs.filter((r) => r.status === 'paid').length} paid · {unplaced.length} waiting for a place ·{' '}
        <Link href="/admin/collections/academy-term-slots/create" className="underline">Add a training time</Link>
      </p>

      {unplaced.length > 0 && (
        <section className="mt-10">
          <h2 className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">Waiting for a place ({unplaced.length})</h2>
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
            {unplaced.map((r) => (
              <li key={r.id} className="grid gap-2 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <p className="font-semibold">{who(r)} <span className="font-normal text-muted">· {by(r) ? groupLabel(by(r)!) : '?'} · {r.reference}</span></p>
                  <p className="text-sm text-muted">{r.contact.firstName} {r.contact.lastName} · {r.contact.email} · {r.contact.phone} · registered {formatDate(r.createdAt, { day: 'numeric', month: 'short' })}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {slots.length ? <OfferForm reg={r.id} options={options(by(r))} /> : <span className="text-xs text-muted">Add a training time first</span>}
                  <CancelForm reg={r.id} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 space-y-6">
        <h2 className="font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">Training times</h2>
        {slots.length === 0 && <p className="text-muted">No training times yet. Until you add some, this program uses the standard booking form.</p>}
        {slots.map((s) => {
          const list = bySlot.get(s.id) ?? []
          const left = spotsLeft(s, taken.get(s.id) ?? 0)
          const sessions = upcomingSessions(s, program)
          return (
            <div key={s.id} className="rounded-2xl border border-line">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line p-4">
                <div>
                  <p className="font-semibold">{slotLabel(s)} <span className="font-normal text-muted">· {yearsLabel(s.birthYears)}{s.active === false ? ' · not taking registrations' : ''}</span></p>
                  <p className="text-sm text-muted">{list.filter((r) => r.status === 'paid').length} paid{s.capacity ? ` of ${s.capacity} · ${left} left` : ''} · {sessions.length} sessions to come</p>
                </div>
                <Link href={`/admin/collections/academy-term-slots/${s.id}`} className="text-sm underline">Edit time / weeks</Link>
              </div>
              {list.length > 0 && (
                <ul className="divide-y divide-line">
                  {list.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                      <span><span className="font-semibold">{who(r)}</span> <span className="text-muted">· {by(r) ? groupLabel(by(r)!) : ''} · {r.contact.phone}</span></span>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
                          {statusLabel[r.status]}{r.status === 'offered' && r.offerExpiresAt ? ` until ${formatDate(r.offerExpiresAt, { day: 'numeric', month: 'short' })}` : ''}
                        </span>
                        {r.status !== 'paid' && <OfferForm reg={r.id} options={options(by(r))} again />}
                        {r.status !== 'paid' && <CancelForm reg={r.id} />}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </section>
    </div>
  )
}
