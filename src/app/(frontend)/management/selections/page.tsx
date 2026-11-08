import Link from 'next/link'
import type { Metadata } from 'next'
import { payload, formatDate } from '@/lib/payload'
import { requireSelector } from './access'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Selections', robots: { index: false } }

export default async function SelectionsPage() {
  await requireSelector('/management/selections')
  const p = await payload()
  const { docs: rounds } = await p.find({ collection: 'selection-rounds', sort: '-createdAt', limit: 100, depth: 1, overrideAccess: true })
  const { docs: entries } = await p.find({ collection: 'selection-entries', where: { round: { in: rounds.map((r) => r.id) } }, limit: 20000, depth: 0, overrideAccess: true, select: { round: true, status: true, outcomeQueued: true } })
  const count = (id: number, f: (e: (typeof entries)[number]) => boolean) => entries.filter((e) => (typeof e.round === 'object' ? e.round.id : e.round) === id && f(e)).length

  return (
    <div className="container-x py-14">
      <p className="eyebrow !text-brand">Management</p>
      <h1 className="mt-2 font-[family-name:var(--font-barlow)] text-5xl font-extrabold uppercase">Selections</h1>
      <p className="mt-3 max-w-2xl text-muted">Tournament and Rowville trial interest, grouped by year of birth. Rounds are created automatically when the first family registers interest.</p>
      <ul className="mt-8 grid gap-4 md:grid-cols-2">
        {rounds.map((r) => (
          <li key={r.id}>
            <Link href={`/management/selections/${r.id}`} className="block rounded-2xl border border-line p-6 hover:border-brand">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand">{r.kind === 'tournament' ? 'Tournament' : 'Rowville trials'} · {r.season} · {r.status}</p>
              <p className="mt-1 font-[family-name:var(--font-barlow)] text-2xl font-bold uppercase">{r.title}</p>
              {r.program && typeof r.program === 'object' && r.program.startDate && <p className="text-sm text-muted">{formatDate(r.program.startDate, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>}
              <p className="mt-3 text-sm">
                {count(r.id, (e) => ['interested', 'trial-booked', 'attended'].includes(e.status))} interested ·{' '}
                {count(r.id, (e) => ['selected', 'offered', 'registered'].includes(e.status))} {r.kind === 'tournament' ? 'selected' : 'successful'} ·{' '}
                {count(r.id, (e) => e.status === 'unsuccessful')} unsuccessful
                {count(r.id, (e) => Boolean(e.outcomeQueued)) > 0 && <strong className="ml-1 text-amber-700">· {count(r.id, (e) => Boolean(e.outcomeQueued))} waiting to send</strong>}
              </p>
            </Link>
          </li>
        ))}
        {rounds.length === 0 && <li className="text-muted">No rounds yet.</li>}
      </ul>
    </div>
  )
}
