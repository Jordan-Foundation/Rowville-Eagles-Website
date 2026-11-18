import Link from 'next/link'
import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { payload } from '@/lib/payload'
import { kitItems } from '@/numbers/fitout'
import { saveKitItems } from '../actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kit items & sizes', robots: { index: false } }

const input = 'min-h-10 border border-line bg-surface px-2 text-sm'

/** Kit items and the sizes for each (one per line). */
export default async function KitItemsPage({ searchParams }: { searchParams: Promise<{ done?: string; error?: string }> }) {
  await requireManagement('/management/fitout/items')
  const sp = await searchParams
  const items = await kitItems(await payload(), { all: true })
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Kit items &amp; sizes</h1>
        <p className="mt-2 text-muted">What gets fitted and the sizes to choose from. Untick an item to stop asking for it (past sizes are kept).</p>
      </div>
      {sp.done && <p role="status" className="border border-line bg-white/5 p-3 text-sm">{sp.done}</p>}
      {sp.error && <p role="alert" className="border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{sp.error}</p>}
      <form action={saveKitItems} className="space-y-4" aria-label="Kit items">
        {items.map((i) => (
          <fieldset key={i.id} className="panel grid gap-3 border border-line p-4 sm:grid-cols-[1fr_auto_auto]" data-kit-item={i.name}>
            <input type="hidden" name="id" value={i.id} />
            <label className="grid gap-1 text-sm">Item<input name={`name-${i.id}`} defaultValue={i.name} className={input} /></label>
            <label className="grid gap-1 text-sm">Order<input name={`order-${i.id}`} type="number" defaultValue={i.sortOrder ?? 0} className={`${input} w-20`} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={`active-${i.id}`} defaultChecked={i.active !== false} />In use</label>
            <label className="grid gap-1 text-sm sm:col-span-3">Sizes (one per line)<textarea name={`sizes-${i.id}`} rows={6} defaultValue={(i.sizes ?? []).map((s) => s.label).join('\n')} className="border border-line bg-surface p-2 text-sm" /></label>
          </fieldset>
        ))}
        <fieldset className="panel grid gap-3 border border-dashed border-line p-4">
          <legend className="px-1 text-sm font-semibold">Add an item</legend>
          <label className="grid gap-1 text-sm">Item<input name="newName" placeholder="e.g. Training shirt" className={input} /></label>
          <label className="grid gap-1 text-sm">Sizes (one per line)<textarea name="newSizes" rows={4} className="border border-line bg-surface p-2 text-sm" /></label>
        </fieldset>
        <button className="min-h-10 bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-black">Save</button>
      </form>
      <p className="text-sm"><Link href="/management/fitout" className="underline">← Fitout</Link></p>
    </div>
  )
}
