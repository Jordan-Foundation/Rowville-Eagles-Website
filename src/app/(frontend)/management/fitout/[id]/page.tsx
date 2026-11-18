import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireManagement } from '@/lib/management'
import { payload, formatDate } from '@/lib/payload'
import { fitoutPlayers, inProgram, kitItems } from '@/numbers/fitout'
import { FitoutEntry } from './FitoutEntry'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Fitout session', robots: { index: false } }

const input = 'min-h-10 border border-line bg-surface px-2 text-sm'

/** One fitout session: look players up and record sizes; see who's done; export the kit order. */
export default async function FitoutSessionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireManagement('/management/fitout')
  const { id } = await params
  const p = await payload()
  const session = await p.findByID({ collection: 'fitout-sessions', id: Number(id), depth: 0, overrideAccess: true, disableErrors: true })
  if (!session) notFound()
  const [players, items, { docs: entries }] = await Promise.all([
    fitoutPlayers(p),
    kitItems(p),
    p.find({ collection: 'fitout-entries', where: { session: { equals: session.id } }, sort: '-updatedAt', limit: 3000, depth: 0, overrideAccess: true, pagination: false }),
  ])
  const eligible = players.filter((x) => inProgram(x, session.program)).sort((a, b) => a.name.localeCompare(b.name))
  const byId = new Map(players.map((x) => [x.id, x]))
  const doneIds = entries.map((e) => (typeof e.participant === 'object' ? e.participant.id : e.participant))
  const teams = [...new Map(eligible.filter((x) => x.teamId).map((x) => [x.teamId!, x.team!])).entries()]
  const years = [...new Set(eligible.map((x) => x.birthYear).filter(Boolean))].sort((a, b) => b! - a!)
  const notExported = entries.filter((e) => !e.exportedAt).length
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">{session.name}</h1>
        <p className="mt-1 text-sm text-muted">{formatDate(session.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {entries.length} of {eligible.length} fitted</p>
      </div>
      <FitoutEntry sessionId={session.id} players={eligible} items={items.map((i) => ({ id: i.id, name: i.name, sizes: (i.sizes ?? []).map((s) => s.label) }))} done={doneIds} />
      <section aria-label="Fitted this session">
        <h2 className="font-semibold">Fitted this session ({entries.length})</h2>
        <ul className="mt-2 divide-y divide-line border border-line text-sm">
          {entries.map((e) => {
            const pl = byId.get(doneIds[entries.indexOf(e)])
            return (
              <li key={e.id} className="flex flex-wrap justify-between gap-2 p-3" data-fitted={pl?.name}>
                <span>{pl?.number ? <strong className="mr-2">#{pl.number}</strong> : <span className="mr-2 text-amber-300">No number</span>}{pl?.name ?? 'Player'}</span>
                <span className="text-muted">{(e.sizes ?? []).map((s) => s.size).join(', ')}{e.notes ? ` · ${e.notes}` : ''}{e.exportedAt ? ' · exported' : ''}</span>
              </li>
            )
          })}
          {!entries.length && <li className="p-3 text-muted">Nobody yet.</li>}
        </ul>
      </section>
      <form action={`/management/fitout/${session.id}/export`} method="get" className="panel flex flex-wrap items-end gap-3 border border-line p-5" aria-label="Export to Excel">
        <label className="grid gap-1 text-sm">Program<select name="program" defaultValue="" className={input}><option value="">RFA and Rowville</option><option value="rfa">RFA</option><option value="rowville">Rowville</option></select></label>
        <label className="grid gap-1 text-sm">Team<select name="team" defaultValue="" className={input}><option value="">Any</option>{teams.map(([tid, name]) => <option key={tid} value={tid}>{name}</option>)}</select></label>
        <label className="grid gap-1 text-sm">Born<select name="birthYear" defaultValue="" className={input}><option value="">Any</option>{years.map((y) => <option key={y} value={y!}>{y}</option>)}</select></label>
        <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" name="notExported" value="1" />Only not yet exported ({notExported})</label>
        <button className="min-h-10 bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-black">Export to Excel</button>
      </form>
      <p className="text-sm"><Link href="/management/fitout" className="underline">← Fitout sessions</Link></p>
    </div>
  )
}
