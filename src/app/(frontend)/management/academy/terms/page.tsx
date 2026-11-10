import { DownloadCsv } from '@/components/management/DownloadCsv'
import { PersonLink } from '@/components/management/PersonLink'
import { requireManagement } from '@/lib/management'
import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { payload, formatMoney, formatDate } from '@/lib/payload'
import { groupLabel } from '@/lib/age-groups'
import { getAgeRules } from '@/lib/age-rules'
import { programPriceLabel } from '@/lib/format'
import { programSlots, slotTaken } from '@/academy/terms/service'
import { slotLabel, spotsLeft, termQuote, upcomingSessions, yearsLabel } from '@/academy/terms/slots'
import { boardRows, clashMap } from '@/academy/terms/board-data'
import type { AcademyCoach } from '@/payload-types'
import { CancelForm, OfferForm, PlaceForm } from './Forms'
import { Board } from './Board'
import { AddGroup, CoachPicker, RemoveGroup } from './SlotPanel'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Academy terms', robots: { index: false } }

const rel = (v: number | { id: number } | null | undefined) => (v && typeof v === 'object' ? v.id : (v ?? null))
const ids = (v: (number | AcademyCoach)[] | null | undefined) => (v ?? []).map((c) => (typeof c === 'object' ? c.id : c))

export default async function StaffTermsPage({ searchParams }: { searchParams: Promise<{ program?: string }> }) {
  const user = await requireManagement('/management/academy/terms')
  const { program: programParam } = await searchParams
  const p = await payload()
  const { docs: programs } = await p.find({ pagination: false, collection: 'programs', where: { type: { in: ['academy-term', 'toddler'] } }, sort: '-startDate', limit: 30, depth: 0, overrideAccess: true })
  const program = programs.find((x) => String(x.id) === programParam) ?? programs.find((x) => x.status === 'open') ?? programs[0]
  if (!program) return <div className="container-x py-14"><p>No Academy term programs yet — create one in the admin (Programs → type “Academy term”).</p></div>

  const [slots, taken, { docs: regs }, { docs: coachDocs }, rules] = await Promise.all([
    programSlots(p, program.id),
    slotTaken(p, program.id),
    p.find({ pagination: false, collection: 'academy-registrations', where: { program: { equals: program.id }, status: { not_equals: 'cancelled' } }, sort: 'player.lastName', limit: 2000, depth: 0, overrideAccess: true }),
    p.find({ pagination: false, collection: 'academy-coaches', where: { active: { equals: true } }, sort: 'displayName', limit: 200, depth: 0, overrideAccess: true }),
    getAgeRules(p),
  ])
  const coaches = coachDocs.map((c) => ({ id: c.id, name: c.displayName }))
  const coachName = new Map(coaches.map((c) => [c.id, c.name]))
  const clashes = await clashMap(p, program, slots, coachName)
  const unplaced = regs.filter((r) => r.status === 'interest' || (r.status === 'offered' && !r.slot))
  // Full-year players whose training time for this term Management still has to choose
  const toPlace = regs.filter((r) => r.status === 'paid' && !r.slot)
  const placed = regs.filter((r) => !unplaced.includes(r) && !toPlace.includes(r))
  const rows = boardRows(placed, slots, rules)
  const options = (by: number | null | undefined) => slots.map((s) => ({ id: s.id, label: `${slotLabel(s)} · ${yearsLabel(s.birthYears)} · ${spotsLeft(s, taken.get(s.id) ?? 0) ?? '∞'} left`, fits: by ? (s.birthYears ?? []).includes(by) : false }))
  const count = (slotId: number, groupId?: string) => placed.filter((r) => rel(r.slot) === slotId && (groupId === undefined || r.groupId === groupId)).length
  const h2 = 'font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase'

  return (
    <div className="container-x py-14">
      <Link href="/management/academy" className="text-sm text-muted hover:text-ink">← Academy</Link>
      <h1 className="mt-4 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">Academy terms</h1>
      <div className="mt-3"><DownloadCsv list="registrations" params={{ program: program.id }} label="Download this program (CSV)" /></div>
      <nav className="mt-4 flex flex-wrap gap-2">
        {programs.map((x) => (
          <Link key={x.id} href={`/management/academy/terms?program=${x.id}`} className={`rounded-full border px-3 py-1 text-sm ${x.id === program.id ? 'border-brand bg-brand text-white' : 'border-line'}`}>{x.title}</Link>
        ))}
      </nav>
      <p className="mt-4 text-sm text-muted">
        {program.startDate && program.endDate ? `${formatDate(program.startDate, { day: 'numeric', month: 'short' })} – ${formatDate(program.endDate, { day: 'numeric', month: 'short', year: 'numeric' })} · ` : ''}
        {programPriceLabel(program)} · {regs.filter((r) => r.status === 'paid').length} paid · {unplaced.length} waiting for a place ·{' '}
        <Link href="/admin/collections/academy-term-slots/create" className="underline">Add a training time</Link> · <Link href="/management/prices" className="underline">Prices</Link>
      </p>

      {toPlace.length > 0 && (
        <section className="mt-10" aria-label="Full-year players to place">
          <h2 className={h2}>Full-year players to place ({toPlace.length})</h2>
          <p className="mt-1 text-sm text-muted">Paid for the full year — their usual night and time doesn’t run this term (or was full). Choose a training time; the family is emailed.</p>
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
            {toPlace.map((r) => {
              const by = r.playingBirthYear ?? r.birthYear
              return (
                <li key={r.id} className="grid gap-2 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <p className="font-semibold">{r.player.firstName} {r.player.lastName} <span className="font-normal text-muted">· {by ? groupLabel(by) : '?'} · {r.reference} · {r.nights === '2' ? '2 nights' : '1 night'}</span></p>
                  {slots.length ? <PlaceForm reg={r.id} options={options(by)} /> : <span className="text-xs text-muted">Add a training time first</span>}
                </li>
              )
            })}
          </ul>
        </section>
      )}
      {unplaced.length > 0 && (
        <section className="mt-10">
          <h2 className={h2}>Waiting for a place ({unplaced.length})</h2>
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
            {unplaced.map((r) => {
              const by = r.playingBirthYear ?? r.birthYear
              return (
                <li key={r.id} className="grid gap-2 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <p className="font-semibold"><PersonLink kind="player" of={r.participant}>{r.player.firstName} {r.player.lastName}</PersonLink> <span className="font-normal text-muted">· {by ? groupLabel(by) : '?'} · {r.reference}</span></p>
                    <p className="text-sm text-muted"><PersonLink kind="family" of={r.account}>{r.contact.firstName} {r.contact.lastName}</PersonLink> · {r.contact.email} · {r.contact.phone} · registered {formatDate(r.createdAt, { day: 'numeric', month: 'short' })}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {slots.length ? <OfferForm reg={r.id} options={options(by)} twoNights={program.twoNightPricePerSession != null} /> : <span className="text-xs text-muted">Add a training time first</span>}
                    <CancelForm reg={r.id} />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className={h2}>Training times, groups & coaches</h2>
        {slots.length === 0 && <p className="mt-4 text-muted">No training times yet. Until you add some, this program uses the standard booking form.</p>}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {slots.map((s) => {
            const left = spotsLeft(s, taken.get(s.id) ?? 0)
            const q = termQuote(s, program, program)
            const sessions = upcomingSessions(s, program)
            return (
              <div key={s.id} className="rounded-2xl border border-line p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{slotLabel(s)} <span className="font-normal text-muted">· {yearsLabel(s.birthYears)}{s.active === false ? ' · not taking registrations' : ''}</span></p>
                  <Link href={`/admin/collections/academy-term-slots/${s.id}`} className="text-xs underline">Edit time / weeks</Link>
                </div>
                <p className="text-sm text-muted">
                  {count(s.id)} player{count(s.id) === 1 ? "" : "s"}{s.capacity ? ` · ${left} of ${s.capacity} places left` : ''} · {sessions.length} sessions to come · joining now: {q.bookable ? formatMoney(q.total) : 'closed'}
                </p>
                <div className="mt-3"><CoachPicker slot={s.id} coaches={coaches} chosen={ids(s.coaches as never)} clashes={clashes.get(String(s.id)) ?? []} /></div>
                <div className="mt-3 space-y-3 border-t border-line pt-3">
                  {(s.groups ?? []).map((g) => (
                    <div key={g.id} className="rounded-xl bg-surface-2 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{g.name} <span className="font-normal text-muted">· {count(s.id, g.id ?? '')} players</span></p>
                        <RemoveGroup slot={s.id} groupId={g.id!} />
                      </div>
                      <div className="mt-1"><CoachPicker slot={s.id} groupId={g.id!} coaches={coaches} chosen={ids(g.coaches as never)} clashes={clashes.get(`${s.id}:${g.id}`) ?? []} /></div>
                    </div>
                  ))}
                  <AddGroup slot={s.id} />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mt-12">
        <h2 className={h2}>Players</h2>
        <p className="mt-1 text-sm text-muted">Grouped by the age group they play in. Tick players to move them to another training time (age rules apply) or put them in a group.</p>
        <div className="mt-4">
          <Board
            programId={program.id}
            rows={rows.map(({ email: _e, medicalText: _m, emergency: _x, ...r }) => r)}
            slots={slots.map((s) => ({ id: s.id, label: slotLabel(s), years: yearsLabel(s.birthYears), groups: (s.groups ?? []).map((g) => ({ id: g.id!, name: g.name })) }))}
            coaches={coaches}
          />
        </div>
      </section>
    </div>
  )
}
