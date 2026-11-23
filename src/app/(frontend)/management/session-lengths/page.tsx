import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { payload } from '@/lib/payload'
import { lengthRules, type ApplyReport } from '@/academy/session-lengths'
import { formatDate } from '@/lib/payload'
import { applyNow, saveLengths } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Session lengths', robots: { index: false } }

const input = 'min-h-10 border border-line bg-surface px-2'
const btn = 'min-h-11 bg-white px-5 text-xs font-semibold uppercase tracking-[0.12em] text-black'

/** Session length by age group (e.g. U7 = 60 minutes) for Academy training times. */
export default async function SessionLengthsPage({ searchParams }: { searchParams: Promise<{ done?: string; error?: string }> }) {
  await requireManagement('/management/session-lengths')
  const sp = await searchParams
  const p = await payload()
  const [rules, s] = await Promise.all([lengthRules(p), p.findGlobal({ slug: 'academy-settings', depth: 0, overrideAccess: true })])
  const last = s.sessionLengthsLastRun as ApplyReport | null
  const rows = [...rules, { ageGroup: '', minutes: 0 }, { ageGroup: '', minutes: 0 }]
  return (
    <div className="max-w-3xl space-y-8 pb-16">
      <header>
        <h1 className="font-display text-4xl font-semibold uppercase">Session lengths</h1>
        <p className="mt-2 text-sm text-muted">How long Academy training sessions run for each age group. Upcoming sessions are updated automatically (every hour, and when you save). Weeks already held keep their old length, so past sessions and coach pay don’t change. A time slot that already has bookings is never changed — it’s listed below for you to review.</p>
      </header>
      {sp.done && <p role="status" className="border border-emerald-500/40 p-3 text-sm">{sp.done}</p>}
      {sp.error && <p role="alert" className="border border-red-500/40 p-3 text-sm text-red-300">{sp.error}</p>}
      <form action={saveLengths} className="space-y-3" aria-label="Session lengths">
        <table className="text-sm">
          <thead className="text-left text-xs text-muted"><tr><th className="pb-1 pr-4 font-medium">Age group</th><th className="pb-1 font-medium">Minutes</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} data-length-row>
                <td className="py-1 pr-4"><input name="ageGroup" defaultValue={r.ageGroup} placeholder="U8" aria-label={`Age group ${i + 1}`} className={`${input} w-24`} /></td>
                <td className="py-1"><input name="minutes" type="number" min={15} max={240} defaultValue={r.minutes || ''} aria-label={`Minutes ${i + 1}`} className={`${input} w-24`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className={btn}>Save and apply</button>
      </form>
      <section className="space-y-2 border border-line p-5" data-last-run>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold uppercase">Last applied</h2>
          <form action={applyNow}><button className="border border-line px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] hover:border-white">Apply now</button></form>
        </div>
        {last ? (
          <>
            <p className="text-sm text-muted">{formatDate(last.at, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
            {last.skipped.length > 0 && (
              <div role="alert" className="border border-amber-400/60 p-3 text-sm" data-skipped>
                <p className="font-semibold">Not changed — these have bookings. Change them by hand if you want to (and let the families know):</p>
                <ul className="mt-1 list-disc pl-5">{last.skipped.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            )}
            {last.changed.length ? <ul className="list-disc pl-5 text-sm" data-changed>{last.changed.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="text-sm text-muted">Everything already matched.</p>}
          </>
        ) : <p className="text-sm text-muted">Not run yet.</p>}
      </section>
    </div>
  )
}
