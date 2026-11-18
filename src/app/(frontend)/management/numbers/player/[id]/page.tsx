import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireManagement } from '@/lib/management'
import { payload, formatDate } from '@/lib/payload'
import { activeNumber, rangeForYear, takenNumbers } from '@/numbers/service'
import { freeNumbers } from '@/numbers/rules'
import { birthYearOf } from '@/lib/age-groups'
import { playerNumberAction } from '../../actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Player number', robots: { index: false } }

/** Management: assign, change or release one player's number, with its history. */
export default async function PlayerNumberPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string; error?: string }> }) {
  await requireManagement('/management/numbers')
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const p = await payload()
  const kid = await p.findByID({ collection: 'participants', id: Number(id), depth: 0, overrideAccess: true, disableErrors: true })
  if (!kid) notFound()
  const by = birthYearOf(kid.dateOfBirth)
  const current = await activeNumber(p, kid.id)
  const range = by ? await rangeForYear(p, by) : null
  const free = range && by ? freeNumbers(range, await takenNumbers(p, by)) : []
  const { docs: log } = await p.find({ collection: 'number-audit-log', where: { participant: { equals: kid.id } }, sort: '-createdAt', limit: 20, depth: 1, overrideAccess: true, pagination: false })
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">{kid.firstName} {kid.lastName}</h1>
        <p className="mt-1 text-muted">Born {by ?? '—'}{range ? ` · numbers ${range.start}–${range.end}` : ''}{kid.status === 'inactive' ? ' · inactive' : ''}</p>
      </div>
      {sp.done && <p role="status" className="border border-line bg-white/5 p-3 text-sm">{sp.done}</p>}
      {sp.error && <p role="alert" className="border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{sp.error}</p>}
      <p className="text-lg" data-current>{current ? <>Wears <strong>{current.number}</strong></> : 'No number'}</p>
      {by ? (
        <form action={playerNumberAction} className="flex flex-wrap items-end gap-2" aria-label="Assign a number">
          <input type="hidden" name="participant" value={kid.id} />
          <label className="grid gap-1 text-sm">{current ? 'Change to' : 'Assign'}<select name="number" className="min-h-10 border border-line bg-surface px-2">{free.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <button className="min-h-10 bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-black">{current ? 'Change number' : 'Assign number'}</button>
        </form>
      ) : <p className="text-sm text-muted">Set the date of birth first (Admin → Participants).</p>}
      {current && (
        <form action={playerNumberAction}>
          <input type="hidden" name="participant" value={kid.id} /><input type="hidden" name="op" value="release" />
          <button className="border border-line px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em]">Release number</button>
        </form>
      )}
      <section aria-label="History">
        <h2 className="font-semibold">History</h2>
        <ul className="mt-2 divide-y divide-line border border-line text-sm">
          {log.map((l) => <li key={l.id} className="p-3" data-audit>{formatDate(l.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })} · {l.action}{l.oldNumber ? ` ${l.oldNumber}` : ''}{l.newNumber ? ` → ${l.newNumber}` : ''}{typeof l.by === 'object' && l.by ? ` · ${l.by.firstName ?? l.by.email}` : ''}</li>)}
          {!log.length && <li className="p-3 text-muted">No changes yet.</li>}
        </ul>
      </section>
      <p className="text-sm"><Link href="/management/numbers" className="underline">← Player numbers</Link> · <Link href={`/management/players/${kid.id}`} className="underline">Player page</Link></p>
    </div>
  )
}
