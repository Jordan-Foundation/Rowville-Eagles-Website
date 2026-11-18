import Link from 'next/link'
import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { payload, formatDate } from '@/lib/payload'
import { localYmd } from '@/lib/time'
import { createSession } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Fitout', robots: { index: false } }

const PROGRAM = { both: 'RFA and Rowville', rfa: 'RFA', rowville: 'Rowville' } as Record<string, string>

/** Fitout sessions: record each player's sizes, then export the kit order. */
export default async function FitoutPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireManagement('/management/fitout')
  const sp = await searchParams
  const p = await payload()
  const { docs } = await p.find({ collection: 'fitout-sessions', sort: '-date', limit: 50, depth: 0, overrideAccess: true, pagination: false })
  const counts = await Promise.all(docs.map((d) => p.count({ collection: 'fitout-entries', where: { session: { equals: d.id } }, overrideAccess: true })))
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Fitout</h1>
          <p className="mt-2 max-w-3xl text-muted">Start a session for each fitout, look players up and record their sizes, then export the kit order to Excel. Each session keeps its own sizes; a player’s last sizes fill in automatically.</p>
        </div>
        <Link href="/management/fitout/items" className="inline-flex min-h-10 items-center border border-line px-4 text-xs font-semibold uppercase tracking-[0.12em]">Kit items &amp; sizes</Link>
      </div>
      {sp.error && <p role="alert" className="border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{sp.error}</p>}
      <form action={createSession} className="panel flex flex-wrap items-end gap-3 border border-line p-5" aria-label="New fitout session">
        <label className="grid gap-1 text-sm">Name<input name="name" required placeholder="Winter 2027 fitout" className="min-h-10 w-64 border border-line bg-surface px-2" /></label>
        <label className="grid gap-1 text-sm">Date<input name="date" type="date" required defaultValue={localYmd(new Date())} className="min-h-10 border border-line bg-surface px-2" /></label>
        <label className="grid gap-1 text-sm">Players<select name="program" className="min-h-10 border border-line bg-surface px-2"><option value="both">RFA and Rowville</option><option value="rfa">RFA</option><option value="rowville">Rowville</option></select></label>
        <button className="min-h-10 bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-black">Start session</button>
      </form>
      <ul className="divide-y divide-line border border-line" aria-label="Fitout sessions">
        {docs.map((d, i) => (
          <li key={d.id}><Link href={`/management/fitout/${d.id}`} className="flex flex-wrap justify-between gap-2 p-4 hover:bg-white/5" data-session={d.name}><span className="font-semibold">{d.name}</span><span className="text-sm text-muted">{formatDate(d.date, { day: 'numeric', month: 'short', year: 'numeric' })} · {PROGRAM[d.program ?? 'both']} · {counts[i].totalDocs} fitted</span></Link></li>
        ))}
        {!docs.length && <li className="p-4 text-sm text-muted">No sessions yet.</li>}
      </ul>
    </div>
  )
}
