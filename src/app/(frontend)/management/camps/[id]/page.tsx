import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireManagement } from '@/lib/management'
import { payload } from '@/lib/payload'
import { campDayLabel, campHoursLabel } from '@/lib/camps'
import { loadCampGroups, regroupCamp } from '@/camps/groups'
import { DownloadCsv } from '@/components/management/DownloadCsv'
import { CampBoard } from './CampBoard'
import { campStaffing, coachChoices, nudgeCampCoaches } from '@/camps/staffing'
import { declineSeenAction, inviteCoachAction, removeCoachAction } from './actions'
import { formatDate } from '@/lib/format'
import type { AcademyCoach } from '@/payload-types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Holiday camp', robots: { index: false } }

/** One holiday camp: its age groups (drag and drop to change) and who's coming each day. */
export default async function CampPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string; error?: string }> }) {
  const { id } = await params
  const sp = await searchParams
  await requireManagement(`/management/camps/${id}`)
  const p = await payload()
  const camp = await p.findByID({ collection: 'programs', id: Number(id), depth: 0, overrideAccess: true, disableErrors: true })
  if (!camp || camp.type !== 'holiday-camp') notFound()
  let data = await loadCampGroups(p, camp)
  // Bookings paid before grouping existed (or a missed update): place them now
  if (data.unplaced > 0) {
    await regroupCamp(p, camp.id)
    data = await loadCampGroups(p, camp)
  }
  await nudgeCampCoaches(p)
  const [staff, choices] = await Promise.all([campStaffing(p, camp), coachChoices(p, camp)])
  const short = (iso: string) => formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
  const STATUS: Record<string, string> = { invited: 'Waiting for an answer', confirmed: 'Confirmed', declined: 'Declined' }
  const dayNames = Object.fromEntries(data.days.map((d) => [d.date, campDayLabel(d.date).split(' ')[0]]))
  return (
    <div className="space-y-8">
      <div>
        <Link href="/management/camps" className="text-sm text-muted hover:text-ink">← Holiday camps</Link>
        <h1 className="mt-2 font-display text-4xl font-semibold uppercase tracking-tight">{camp.title}</h1>
        <p className="mt-2 text-muted">
          {data.days.length ? `${campDayLabel(data.days[0].date)} – ${campDayLabel(data.days.at(-1)!.date)} · ${campHoursLabel(data.days[0])}` : 'No camp days set'} · {camp.status}
        </p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href={`/management/programs/setup/${camp.id}`} className="underline">Camp setup</Link>
          <Link href={`/programs/${camp.slug}`} className="underline">Public page</Link>
          <Link href={`/admin/collections/programs/${camp.id}`} className="text-muted underline">Camp days &amp; prices (admin)</Link>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <DownloadCsv list="bookings" params={{ program: camp.id }} label="Download bookings (CSV)" />
          <Link href={`/camps/${camp.id}/print/attendance${data.days[0] ? `?day=${data.days[0].date}` : ''}`} className="inline-flex min-h-10 items-center border border-line px-3 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white">Attendance sheets</Link>
          <Link href={`/camps/${camp.id}/print/emergency`} className="inline-flex min-h-10 items-center border border-line px-3 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white">Emergency contacts sheet</Link>
        </div>
      </div>

      {(sp.done || sp.error) && <p role={sp.error ? 'alert' : 'status'} className={`border p-4 text-sm ${sp.error ? 'border-red-400/40 text-red-200' : 'border-emerald-400/40 text-emerald-200'}`}>{sp.error ?? sp.done}</p>}
      <dl className="panel grid gap-x-8 gap-y-3 border border-line p-5 text-sm sm:grid-cols-3">
        <div><dt className="text-muted">Children booked</dt><dd className="font-display text-2xl font-semibold">{data.children}</dd></div>
        <div><dt className="text-muted">Groups</dt><dd className="font-display text-2xl font-semibold">{data.groups.length}</dd></div>
        <div><dt className="text-muted">Coaches</dt><dd className="font-display text-2xl font-semibold">{staff.confirmed.length} of {staff.needed} confirmed</dd>{staff.invited.length > 0 && <dd className="text-xs text-muted">{staff.invited.length} waiting for an answer</dd>}</div>
      </dl>

      <section id="coaches" className="space-y-4">
        <h2 className="font-display text-2xl font-semibold uppercase">Coaches</h2>
        <p className="text-sm text-muted">
          Needed: {staff.needed} — {staff.maxGroups} group{staff.maxGroups === 1 ? '' : 's'} on the busiest day × {staff.settings.coachesPerGroup} + {staff.extra} extra.
          {' '}Coaches get an email and text to confirm; they’re reminded after {staff.settings.confirmReminderHours} hours and you’re told after {staff.settings.escalateHours}.
        </p>
        {staff.gap.short > 0 && <p role="note" className="border border-amber-400/50 bg-amber-400/10 p-3 text-sm">{camp.title} needs {staff.gap.short} more coach{staff.gap.short === 1 ? '' : 'es'}.</p>}
        {staff.gap.over > 0 && <p role="note" className="border border-sky-400/50 bg-sky-400/10 p-3 text-sm">{staff.gap.over} coach{staff.gap.over === 1 ? ' is' : 'es are'} no longer needed now the groups are smaller — remove one if you like (nobody is taken off automatically).</p>}
        <ul className="divide-y divide-line border border-line">
          {staff.coaches.map((c) => {
            const coach = c.coach as AcademyCoach
            return (
              <li key={c.id} data-camp-coach={coach.displayName} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <span>
                  <span className="font-semibold">{coach.displayName}</span>
                  <span className={`ml-2 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${c.status === 'confirmed' ? 'bg-emerald-400/20 text-emerald-200' : c.status === 'declined' ? 'bg-red-500/20 text-red-300' : 'bg-amber-400/20 text-amber-200'}`}>{STATUS[c.status]}</span>
                  <span className="block text-xs text-muted">Asked {short(c.invitedAt)}{c.remindedAt ? ` · reminded ${short(c.remindedAt)}` : ''}{c.escalatedAt && c.status === 'invited' ? ' · no answer yet' : ''}{c.respondedAt ? ` · answered ${short(c.respondedAt)}` : ''}{c.declineReason ? ` · “${c.declineReason}”` : ''}</span>
                </span>
                <span className="flex gap-2">
                  {c.status === 'declined' && !c.declineSeen && (
                    <form action={declineSeenAction}><input type="hidden" name="camp" value={camp.id} /><input type="hidden" name="campCoach" value={c.id} /><button className="min-h-9 border border-line px-3 text-xs">OK, seen</button></form>
                  )}
                  {c.status !== 'declined' && (
                    <form action={removeCoachAction}><input type="hidden" name="camp" value={camp.id} /><input type="hidden" name="campCoach" value={c.id} /><button className="min-h-9 border border-line px-3 text-xs">Remove</button></form>
                  )}
                </span>
              </li>
            )
          })}
          {staff.coaches.length === 0 && <li className="p-4 text-sm text-muted">No coaches asked yet.</li>}
        </ul>
        <form action={inviteCoachAction} className="panel space-y-3 border border-line p-4">
          <input type="hidden" name="camp" value={camp.id} />
          <fieldset>
            <legend className="text-sm font-semibold">Ask a coach</legend>
            <ul className="mt-2 space-y-1 text-sm">
              {choices.filter((c) => !c.onCamp).map((c) => (
                <li key={c.id}>
                  <label className="flex items-start gap-2">
                    <input type="radio" name="coach" value={c.id} required className="mt-1" />
                    <span>
                      <span className="font-semibold">{c.name}</span>{' '}
                      {c.clashes.length ? <span className="text-amber-300">— {c.clashes.join('; ')}</span> : <span className="text-emerald-300">— free all camp days</span>}
                    </span>
                  </label>
                </li>
              ))}
              {choices.filter((c) => !c.onCamp).length === 0 && <li className="text-muted">Every active coach is already on this camp.</li>}
            </ul>
          </fieldset>
          <button className="min-h-10 border border-white/60 px-4 text-xs font-semibold uppercase tracking-[0.15em] hover:bg-white hover:text-black">Send request</button>
        </form>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold uppercase">Each day</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[32rem] border border-line text-sm">
            <thead><tr className="border-b border-line text-left text-muted"><th className="p-3">Day</th><th className="p-3">Children</th><th className="p-3">Groups that day</th></tr></thead>
            <tbody>
              {data.perDay.map((d) => (
                <tr key={d.date} className="border-b border-line align-top">
                  <th scope="row" className="p-3 text-left font-semibold">{campDayLabel(d.date)}</th>
                  <td className="p-3">{d.total}{camp.capacity ? <span className="text-muted"> of {camp.capacity}</span> : null}</td>
                  <td className="p-3">{d.groups.length ? d.groups.map((g) => `${g.label} (${g.kids})`).join(' · ') : <span className="text-muted">Nobody yet</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">A group with fewer than {data.rules.min} children on a day joins its nearest age group for that day. Children keep their own group on the other days.</p>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold uppercase">Age groups</h2>
        {data.groups.length === 0 ? (
          <p className="mt-3 border border-line p-4 text-sm text-muted">No children booked yet — groups appear as bookings are paid.</p>
        ) : (
          <div className="mt-3"><CampBoard campId={camp.id} groups={data.groups} dayNames={dayNames} totalDays={data.days.length} /></div>
        )}
      </section>
    </div>
  )
}
