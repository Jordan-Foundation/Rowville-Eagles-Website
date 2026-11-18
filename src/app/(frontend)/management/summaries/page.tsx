import Link from 'next/link'
import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { payload, formatDate } from '@/lib/payload'
import { pendingSummaries } from '@/academy/summaries/service'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Session summaries', robots: { index: false } }

/** Who still owes a session summary, and the latest ones written (incl. coach & admin notes). */
export default async function ManagementSummaries() {
  await requireManagement('/management/summaries')
  const p = await payload()
  const [pending, { docs: recent }, { docs: coaches }] = await Promise.all([
    pendingSummaries(p),
    p.find({ collection: 'session-summaries', sort: '-submittedAt', limit: 40, depth: 1, overrideAccess: true, pagination: false }),
    p.find({ collection: 'academy-coaches', limit: 500, depth: 0, overrideAccess: true, pagination: false, select: { displayName: true } }),
  ])
  const coachName = new Map(coaches.map((c) => [c.id, c.displayName]))
  const late = (at: string) => Date.now() - Date.parse(at) > 48 * 3_600_000
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Session summaries</h1>
        <p className="mt-2 max-w-3xl text-muted">Coaches write a 2-minute summary after each 1-on-1 and small group session. Families are emailed it straight away and see it on the player’s profile; the coach &amp; admin notes stay here. Coaches get an email + notification at 8pm with one link for the day’s sessions, and a reminder at 9am next day. Hide one from the family in Admin → Session summaries.</p>
      </div>
      <section className="space-y-2" aria-label="Still to write">
        <h2 className="font-semibold">Still to write ({pending.length})</h2>
        <ul className="divide-y divide-line border border-line">
          {pending.map((x) => (
            <li key={x.sessionId} className="flex flex-wrap justify-between gap-2 p-3 text-sm" data-pending={x.sessionId}>
              <span>{x.title} · {coachName.get(x.coachId) ?? 'Coach'}</span>
              <span className={late(x.at) ? 'font-semibold text-amber-300' : 'text-muted'}>{formatDate(x.at, { weekday: 'short', day: 'numeric', month: 'short' })}{late(x.at) ? ' · overdue' : ''}</span>
            </li>
          ))}
          {!pending.length && <li className="p-3 text-sm text-muted">All caught up.</li>}
        </ul>
      </section>
      <section className="space-y-2" aria-label="Latest summaries">
        <h2 className="font-semibold">Latest</h2>
        <ul className="divide-y divide-line border border-line">
          {recent.map((r) => (
            <li key={r.id} className="space-y-1 p-4 text-sm" data-summary-row>
              <p className="flex flex-wrap justify-between gap-2"><span className="font-semibold">{r.title}</span><span className="text-muted">{typeof r.coach === 'object' && r.coach ? r.coach.displayName : ''}{r.hidden ? ' · hidden from family' : ''}</span></p>
              <p className="text-muted">Worked on: {(r.workedOn ?? []).join(', ')}{r.effort ? ` · effort ${r.effort}/5` : ''}</p>
              {r.wentWell && <p><span className="text-muted">Went well: </span>{r.wentWell}</p>}
              {r.nextSteps && <p><span className="text-muted">Next steps: </span>{r.nextSteps}</p>}
              {r.privateNotes && <p className="border-l-2 border-amber-400/60 pl-2"><span className="text-muted">🔒 Coach &amp; admin notes: </span>{r.privateNotes}</p>}
              <Link href={`/admin/collections/session-summaries/${r.id}`} className="text-xs underline">Edit or hide</Link>
            </li>
          ))}
          {!recent.length && <li className="p-3 text-sm text-muted">None yet.</li>}
        </ul>
      </section>
    </div>
  )
}
