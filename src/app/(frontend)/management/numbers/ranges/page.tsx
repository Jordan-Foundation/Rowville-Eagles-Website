import Link from 'next/link'
import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { payload } from '@/lib/payload'
import { storedRanges } from '@/numbers/service'
import { groupLabel } from '@/lib/age-groups'
import { saveRanges } from '../actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Number ranges', robots: { index: false } }

/** Each year of birth's number range. Stored, so it never shifts between seasons. */
export default async function RangesPage({ searchParams }: { searchParams: Promise<{ done?: string; error?: string }> }) {
  await requireManagement('/management/numbers/ranges')
  const sp = await searchParams
  const p = await payload()
  await storedRanges(p)
  const [{ docs }, { docs: nums }] = await Promise.all([
    p.find({ collection: 'number-ranges', sort: '-birthYear', limit: 200, depth: 0, overrideAccess: true, pagination: false }),
    p.find({ collection: 'player-numbers', where: { status: { equals: 'active' } }, limit: 3000, depth: 0, overrideAccess: true, pagination: false, select: { birthYear: true } }),
  ])
  const held = (y: number) => nums.filter((n) => n.birthYear === y).length
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Number ranges</h1>
        <p className="mt-2 text-muted">The youngest year started on 51–99, then 2–50, alternating. A new, younger year carries the pattern on automatically. Ranges can’t include 1 (goalkeeper tops). Changing a range doesn’t change numbers players already wear.</p>
      </div>
      {sp.done && <p role="status" className="border border-line bg-white/5 p-3 text-sm">{sp.done}</p>}
      {sp.error && <p role="alert" className="border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{sp.error}</p>}
      <form action={saveRanges} className="space-y-3" aria-label="Number ranges">
        <ul className="divide-y divide-line border border-line">
          {docs.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 p-3 text-sm" data-range-row={r.birthYear}>
              <input type="hidden" name="id" value={r.id} /><input type="hidden" name={`year-${r.id}`} value={r.birthYear} />
              <span className="w-40"><strong>{r.birthYear}</strong> <span className="text-muted">{groupLabel(r.birthYear)}</span></span>
              <input name={`start-${r.id}`} type="number" min={2} max={99} defaultValue={r.start} aria-label={`${r.birthYear} from`} className="min-h-9 w-20 border border-line bg-surface px-2" />–
              <input name={`end-${r.id}`} type="number" min={2} max={99} defaultValue={r.end} aria-label={`${r.birthYear} to`} className="min-h-9 w-20 border border-line bg-surface px-2" />
              {held(r.birthYear) > 0 && <span className="text-xs text-amber-300">⚠ {held(r.birthYear)} player{held(r.birthYear) === 1 ? '' : 's'} already wear numbers in this year</span>}
            </li>
          ))}
        </ul>
        <button className="min-h-10 bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-black">Save ranges</button>
      </form>
      <p className="text-sm"><Link href="/management/numbers" className="underline">← Player numbers</Link></p>
    </div>
  )
}
