import Link from 'next/link'
import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { payload } from '@/lib/payload'
import { storedRanges } from '@/numbers/service'
import { numbersIn } from '@/numbers/rules'
import { groupLabel } from '@/lib/age-groups'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Player numbers', robots: { index: false } }

const chip = (on: boolean) => `px-3 py-1.5 text-sm ${on ? 'bg-white text-black' : 'border border-line'}`

/** Shirt numbers by year of birth: range, taken / free, who wears what; plus players still to pick. */
export default async function NumbersPage({ searchParams }: { searchParams: Promise<{ program?: string; team?: string; year?: string }> }) {
  await requireManagement('/management/numbers')
  const sp = await searchParams
  const p = await payload()
  const ranges = (await storedRanges(p)).sort((a, b) => b.birthYear - a.birthYear)
  const [{ docs: nums }, { docs: waiting }, { docs: teams }] = await Promise.all([
    p.find({ collection: 'player-numbers', where: { status: { equals: 'active' } }, limit: 3000, depth: 1, overrideAccess: true, pagination: false }),
    p.find({ collection: 'participants', where: { 'numbers.required': { equals: true }, status: { not_equals: 'inactive' } }, limit: 500, depth: 0, overrideAccess: true, pagination: false }),
    p.find({ collection: 'teams', where: { archived: { not_equals: true } }, limit: 200, depth: 0, overrideAccess: true, pagination: false, select: { name: true } }),
  ])
  const holders = new Set(nums.map((n) => (typeof n.participant === 'object' ? n.participant.id : n.participant)))
  const toPick = waiting.filter((k) => !holders.has(k.id))
  const kidOf = (n: (typeof nums)[number]) => (typeof n.participant === 'object' ? n.participant : null)
  const shown = nums.filter((n) => {
    const k = kidOf(n)
    if (!k) return false
    if (sp.program && !(k.memberships ?? []).includes(sp.program as 'rowville' | 'rfa')) return false
    if (sp.team && String(typeof k.team === 'object' ? k.team?.id : k.team) !== sp.team) return false
    if (sp.year && String(n.birthYear) !== sp.year) return false
    return true
  })
  const qs = (o: Record<string, string | undefined>) => '?' + new URLSearchParams(Object.entries({ program: sp.program, team: sp.team, year: sp.year, ...o }).filter(([, v]) => v) as [string, string][]).toString()
  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Player numbers</h1>
          <p className="mt-2 max-w-3xl text-muted">Players pick a shirt number after paying for an RFA term or Eagles registration. Numbers are unique within a year of birth, 1 is kept for goalkeeper tops, and seniors don’t pick. Marking a player inactive releases their number.</p>
        </div>
        <Link href="/management/numbers/ranges" className="inline-flex min-h-10 items-center border border-line px-4 text-xs font-semibold uppercase tracking-[0.12em]">Number ranges</Link>
      </div>
      {toPick.length > 0 && (
        <section className="panel border border-amber-400/50 p-4 text-sm" aria-label="Still to pick">
          <p className="font-semibold">Still to pick ({toPick.length})</p>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">{toPick.map((k) => <Link key={k.id} href={`/management/numbers/player/${k.id}`} className="underline">{k.firstName} {k.lastName}</Link>)}</p>
        </section>
      )}
      <div className="overflow-x-auto border border-line">
        <table className="w-full min-w-[560px] text-left text-sm" aria-label="Ranges">
          <thead className="text-xs text-muted"><tr>{['Born', 'Age group', 'Range', 'Taken', 'Free'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            {ranges.map((r) => {
              const taken = nums.filter((n) => n.birthYear === r.birthYear).length
              const free = numbersIn(r).length - taken
              return (
                <tr key={r.birthYear} data-range={r.birthYear}>
                  <td className="px-3 py-2"><Link href={`/management/numbers${qs({ year: String(r.birthYear) })}`} className="underline">{r.birthYear}</Link></td>
                  <td className="px-3 py-2 text-muted">{groupLabel(r.birthYear)}</td>
                  <td className="px-3 py-2">{r.start}–{r.end}</td>
                  <td className="px-3 py-2">{taken}</td>
                  <td className={`px-3 py-2 ${free <= 3 ? 'font-semibold text-amber-300' : ''}`}>{free}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <nav className="flex flex-wrap gap-2" aria-label="Filter">
        <Link href={`/management/numbers${qs({ program: undefined })}`} className={chip(!sp.program)}>All</Link>
        <Link href={`/management/numbers${qs({ program: 'rowville' })}`} className={chip(sp.program === 'rowville')}>Rowville</Link>
        <Link href={`/management/numbers${qs({ program: 'rfa' })}`} className={chip(sp.program === 'rfa')}>RFA</Link>
        <form className="flex gap-2"><select name="team" defaultValue={sp.team ?? ''} className="min-h-9 border border-line bg-surface px-2 text-sm">{[<option key="" value="">Any team</option>, ...teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)]}</select>{sp.program && <input type="hidden" name="program" value={sp.program} />}{sp.year && <input type="hidden" name="year" value={sp.year} />}<button className="border border-line px-3 text-sm">Filter</button></form>
        {(sp.year || sp.team) && <Link href="/management/numbers" className="px-2 py-1.5 text-sm underline">Clear</Link>}
      </nav>
      <ul className="divide-y divide-line border border-line" aria-label="Players with numbers">
        {shown.sort((a, b) => b.birthYear - a.birthYear || a.number - b.number).map((n) => {
          const k = kidOf(n)!
          return (
            <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm" data-number-row={n.number}>
              <span><strong className="mr-3 inline-block w-8 text-right">{n.number}</strong>{k.firstName} {k.lastName} <span className="text-muted">· {n.birthYear}{(k.memberships ?? []).length ? ` · ${(k.memberships ?? []).filter((m) => m !== 'foundation-plus').map((m) => (m === 'rfa' ? 'RFA' : 'Rowville')).join(' + ')}` : ''}</span></span>
              <Link href={`/management/numbers/player/${k.id}`} className="text-xs underline">Change or release</Link>
            </li>
          )
        })}
        {!shown.length && <li className="p-3 text-sm text-muted">No numbers yet.</li>}
      </ul>
    </div>
  )
}
