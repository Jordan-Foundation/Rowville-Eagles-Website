import type { Metadata } from 'next'
import Link from 'next/link'
import { requireManagement } from '@/lib/management'
import { payload } from '@/lib/payload'
import { formatDate } from '@/lib/format'
import { undoBlockers } from '@/imports/run'
import { ImportForm } from './ImportForm'
import { undoAction } from './actions'

export const dynamic = 'force-dynamic'
export const maxDuration = 300
export const metadata: Metadata = { title: 'Import players', robots: { index: false } }

/** Load every existing player from the template, with their family accounts, so families have nothing to fill in. */
export default async function ImportPlayersPage({ searchParams }: { searchParams: Promise<{ done?: string; error?: string }> }) {
  await requireManagement('/management/players/import')
  const sp = await searchParams
  const p = await payload()
  const { docs: batches } = await p.find({ collection: 'import-batches', sort: '-createdAt', limit: 20, depth: 1, overrideAccess: true })
  const blockers = new Map(await Promise.all(batches.filter((b) => b.status === 'imported').map(async (b) => [b.id, await undoBlockers(p, b.id)] as const)))
  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Import players</h1>
        <p className="mt-2 max-w-3xl text-muted">Fill in the template (one row per player — siblings share Parent 1’s email), then upload it. You’ll see a preview first and nothing is saved until you press Import. Families aren’t messaged — the launch email is sent separately.</p>
        <p className="mt-3"><a href="/management/players/import/template" className="underline" data-template>Download template</a></p>
      </div>
      {(sp.done || sp.error) && <p role={sp.error ? 'alert' : 'status'} className={`border p-3 text-sm ${sp.error ? 'border-red-400/40 text-red-200' : 'border-emerald-400/40 text-emerald-200'}`}>{sp.error ?? sp.done}</p>}
      <ImportForm />
      {batches.length > 0 && (
        <section aria-label="Previous imports" className="space-y-2">
          <h2 className="font-display text-2xl font-semibold uppercase">Previous imports</h2>
          <ul className="divide-y divide-line border border-line text-sm">
            {batches.map((b) => {
              const c = (b.counts ?? {}) as { familiesCreated?: number; familiesMatched?: number; playersCreated?: number; playersUpdated?: number; skipped?: number }
              const blocked = blockers.get(b.id) ?? []
              return (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-3" data-batch={b.id} data-batch-status={b.status}>
                  <span><strong>{b.fileName}</strong> <span className="text-muted">· {formatDate(b.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {typeof b.by === 'object' && b.by ? b.by.firstName || b.by.email : ''} · {c.familiesCreated ?? 0} new families, {c.playersCreated ?? 0} players created, {c.playersUpdated ?? 0} updated</span></span>
                  {b.status === 'undone' ? <span className="text-muted">Undone</span> : blocked.length ? (
                    <span className="text-xs text-muted">Can’t undo — {blocked.length} famil{blocked.length === 1 ? 'y has' : 'ies have'} been messaged or signed in</span>
                  ) : (
                    <form action={undoAction} className="flex items-center gap-2"><input type="hidden" name="batch" value={b.id} /><label className="flex items-center gap-1 text-xs text-muted"><input type="checkbox" required /> I’m sure</label><button className="text-xs underline">Undo batch</button></form>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
      <p className="flex gap-4 text-sm"><Link href="/management/players/owing" className="underline">Registration owing →</Link><Link href="/management/launch" className="underline">Portal launch →</Link></p>
    </div>
  )
}
