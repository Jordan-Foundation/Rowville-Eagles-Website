import type { Metadata } from 'next'
import Link from 'next/link'
import { requireCoach } from '@/academy/portal'
import { payload, formatDate } from '@/lib/payload'
import { levelName } from '@/academy/curriculum/levels'
import { OUTSTANDING, REPORT_STATUSES, statusLabel, type ReportStatus } from '@/academy/reports/rules'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Reports', robots: { index: false } }

const tone: Record<string, string> = {
  not_started: 'border-line text-muted',
  draft: 'border-amber-300/60 text-amber-300',
  returned: 'border-red-400/70 text-red-300',
  submitted: 'border-sky-300/60 text-sky-300',
  approved: 'border-emerald-300/60 text-emerald-300',
  released: 'border-emerald-300/60 text-emerald-300',
}

export default async function CoachReportsPage({ searchParams }: { searchParams: Promise<{ cycle?: string; status?: string }> }) {
  const { user } = await requireCoach('/coach/reports')
  const sp = await searchParams
  const p = await payload()
  const { docs: all } = await p.find({ collection: 'player-reports', where: { coach: { equals: user.id } }, limit: 2000, depth: 1, sort: 'playerName', overrideAccess: true })
  const cycles = [...new Map(all.map((r) => [typeof r.cycle === 'object' ? r.cycle.id : r.cycle, r.cycle])).values()].filter((c) => typeof c === 'object')
  const openCycles = cycles.filter((c) => c.status === 'open').sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const cycleId = Number(sp.cycle) || openCycles[0]?.id || cycles[0]?.id
  const cycle = cycles.find((c) => c.id === cycleId)
  const inCycle = all.filter((r) => (typeof r.cycle === 'object' ? r.cycle.id : r.cycle) === cycleId)
  const status = REPORT_STATUSES.some((s) => s.value === sp.status) ? (sp.status as ReportStatus) : sp.status === 'todo' ? 'todo' : ''
  const shown = inCycle.filter((r) => (status === 'todo' ? OUTSTANDING.includes(r.status as ReportStatus) : status ? r.status === status : true))
  // Returned first, then drafts, then not started, then the rest
  const order = ['returned', 'draft', 'not_started', 'submitted', 'approved', 'released']
  shown.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.playerName.localeCompare(b.playerName))
  const todo = inCycle.filter((r) => OUTSTANDING.includes(r.status as ReportStatus)).length
  const groups = [...new Set(shown.map((r) => r.sourceLabel ?? ''))]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">Player reports</h1>
        <p className="mt-3 text-muted">Rate each player against the curriculum standard for their level, then write an overall comment. Your work saves as you type.</p>
      </div>
      {!cycle ? (
        <p className="panel border border-line p-6 text-muted">You don’t have any reports to write. You’ll get an email when a report round starts.</p>
      ) : (
        <>
          <div className="panel border border-line p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">{cycle.status === 'open' ? 'Report round' : 'Closed round'}</p>
            <h2 className="mt-1 font-display text-2xl font-semibold uppercase">{cycle.name}</h2>
            <p className="mt-1 text-sm">Due <strong>{formatDate(cycle.dueDate, { weekday: 'long', day: 'numeric', month: 'long' })}</strong> · {todo === 0 ? 'all done — thank you!' : `${todo} of ${inCycle.length} still to finish`}</p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10" aria-hidden>
              <div className="h-full bg-emerald-400" style={{ width: `${inCycle.length ? Math.round(((inCycle.length - todo) / inCycle.length) * 100) : 0}%` }} />
            </div>
          </div>
          <form className="flex flex-wrap items-end gap-3 text-sm" method="get">
            {cycles.length > 1 && (
              <label>Round
                <select name="cycle" defaultValue={cycleId} className="mt-1 block border border-line bg-black/40 px-3 py-2">
                  {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
            <label>Show
              <select name="status" defaultValue={status} className="mt-1 block border border-line bg-black/40 px-3 py-2">
                <option value="">All</option>
                <option value="todo">Still to do</option>
                {REPORT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <button className="border border-line px-4 py-2 font-semibold">Filter</button>
          </form>
          {shown.length === 0 && <p className="text-muted">No reports match.</p>}
          {groups.map((g) => (
            <section key={g} aria-label={g || 'Players'}>
              {g && <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">{g}</h3>}
              <ul className="divide-y divide-line border border-line">
                {shown.filter((r) => (r.sourceLabel ?? '') === g).map((r) => (
                  <li key={r.id}>
                    <Link href={`/coach/reports/${r.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-white/5">
                      <span>
                        <span className="font-semibold">{r.playerName}</span>
                        <span className="ml-2 text-sm text-muted">{levelName(r.level)}</span>
                      </span>
                      <span className={`shrink-0 border px-2 py-0.5 text-xs font-semibold uppercase ${tone[r.status] ?? ''}`}>{statusLabel(r.status)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
