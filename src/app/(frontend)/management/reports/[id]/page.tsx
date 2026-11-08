import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireManagement } from '@/lib/management'
import { payload, formatDate } from '@/lib/payload'
import { levelName } from '@/academy/curriculum/levels'
import { REPORT_STATUSES, statusLabel } from '@/academy/reports/rules'
import { CreateReportsButton } from '../Forms'
import { reassignAction, setCycleStatusAction } from '../actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Report round', robots: { index: false } }

const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null))

export default async function CyclePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ coach?: string; status?: string }> }) {
  const { id } = await params
  await requireManagement(`/management/reports/${id}`)
  const sp = await searchParams
  const p = await payload()
  const cycle = await p.findByID({ collection: 'report-cycles', id: Number(id), depth: 1, overrideAccess: true, disableErrors: true })
  if (!cycle) notFound()
  const [{ docs: reports }, { docs: coaches }] = await Promise.all([
    p.find({ collection: 'player-reports', where: { cycle: { equals: cycle.id } }, sort: 'playerName', limit: 5000, depth: 0, overrideAccess: true }),
    p.find({ collection: 'users', where: { roles: { contains: 'coach' } }, sort: 'firstName', limit: 300, depth: 0, overrideAccess: true, select: { firstName: true, lastName: true, email: true } }),
  ])
  const coachName = new Map(coaches.map((c) => [c.id, [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email]))
  const byStatus = REPORT_STATUSES.map((s) => ({ ...s, n: reports.filter((r) => r.status === s.value).length }))
  const submitted = reports.filter((r) => ['submitted', 'approved', 'released'].includes(r.status)).length
  const coachFilter = sp.coach === 'none' ? 'none' : Number(sp.coach) || null
  const shown = reports.filter((r) => (coachFilter === 'none' ? !r.coach : coachFilter ? idOf(r.coach) === coachFilter : true) && (sp.status ? r.status === sp.status : true))
  const perCoach = [...new Set(reports.map((r) => idOf(r.coach)))].map((c) => ({ id: c, name: c ? (coachName.get(c) ?? `#${c}`) : 'No coach', total: reports.filter((r) => idOf(r.coach) === c).length, done: reports.filter((r) => idOf(r.coach) === c && ['submitted', 'approved', 'released'].includes(r.status)).length }))
  const scope = [...(cycle.programs ?? []).map((x) => (typeof x === 'object' ? x.title : `Program #${x}`)), ...(cycle.teams ?? []).map((t) => (typeof t === 'object' ? t.name : `Team #${t}`))]
  const h2 = 'font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase'

  return (
    <div className="container-x max-w-5xl py-14">
      <Link href="/management/reports" className="text-sm text-muted hover:text-ink">← Reports</Link>
      <h1 className="mt-4 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">{cycle.name}</h1>
      <p className="mt-2 text-muted">
        Season {cycle.season} · coaches finish by {formatDate(cycle.dueDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {cycle.status === 'open' ? 'open' : 'closed (no reminders)'} ·{' '}
        <Link href={`/admin/collections/report-cycles/${cycle.id}`} className="underline">Edit</Link>
      </p>
      <p className="mt-1 text-sm text-muted">Covers: {scope.join(', ') || 'nothing yet'}</p>

      <div className="mt-6 flex flex-wrap items-start gap-4">
        <CreateReportsButton cycle={cycle.id} first={reports.length === 0} />
        <form action={setCycleStatusAction}>
          <input type="hidden" name="cycle" value={cycle.id} />
          <input type="hidden" name="status" value={cycle.status === 'open' ? 'closed' : 'open'} />
          <button className="rounded-full border border-line px-5 py-2 text-sm font-semibold">{cycle.status === 'open' ? 'Close round' : 'Reopen round'}</button>
        </form>
      </div>

      {reports.length > 0 && (
        <>
          <section className="mt-10" aria-label="Progress">
            <h2 className={h2}>{submitted} / {reports.length} submitted</h2>
            <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <div className="bg-emerald-500" style={{ width: `${(submitted / reports.length) * 100}%` }} />
              <div className="bg-amber-400" style={{ width: `${(byStatus.find((s) => s.value === 'draft')!.n / reports.length) * 100}%` }} />
            </div>
            <ul className="mt-3 flex flex-wrap gap-2 text-sm">
              {byStatus.map((s) => <li key={s.value}><Link href={`?status=${s.value}`} className="rounded-full border border-line px-3 py-1">{s.label}: <strong>{s.n}</strong></Link></li>)}
              <li><Link href="?" className="rounded-full border border-line px-3 py-1">All</Link></li>
            </ul>
            <table className="mt-5 w-full text-sm">
              <thead><tr className="text-left text-muted"><th className="py-2">Coach</th><th>Submitted</th></tr></thead>
              <tbody className="divide-y divide-line">
                {perCoach.map((c) => (
                  <tr key={String(c.id)}><td className="py-2"><Link className="underline" href={`?coach=${c.id ?? 'none'}`}>{c.name}</Link></td><td className={c.id ? '' : 'font-semibold text-red-700'}>{c.done} / {c.total}</td></tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mt-10" aria-label="Reports">
            <h2 className={h2}>Reports ({shown.length})</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead><tr className="text-left text-muted"><th className="py-2">Player</th><th>Level</th><th>Group / team</th><th>Status</th><th>Written by</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {shown.map((r) => (
                    <tr key={r.id} className="align-top">
                      <td className="py-2 font-semibold"><Link href={`/admin/collections/player-reports/${r.id}`} className="hover:underline">{r.playerName}</Link></td>
                      <td>{levelName(r.level)}</td>
                      <td className="max-w-56 text-muted">{r.sourceLabel}</td>
                      <td>{statusLabel(r.status)}</td>
                      <td>
                        <form action={reassignAction} className="flex gap-1">
                          <input type="hidden" name="report" value={r.id} />
                          <input type="hidden" name="cycle" value={cycle.id} />
                          <select name="coach" defaultValue={idOf(r.coach) ?? ''} aria-label={`Coach for ${r.playerName}`} className="rounded border border-line px-2 py-1">
                            <option value="">— choose —</option>
                            {coaches.map((c) => <option key={c.id} value={c.id}>{coachName.get(c.id)}</option>)}
                          </select>
                          <button className="rounded border border-line px-2 py-1">Save</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
