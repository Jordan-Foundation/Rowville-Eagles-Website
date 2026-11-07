import Link from 'next/link'
import type { Metadata } from 'next'
import { payload, formatDate } from '@/lib/payload'
import { requireCoach } from '@/academy/portal'
import { groupLabel, birthYearOf } from '@/lib/age-groups'
import type { Participant, PdrStage } from '@/payload-types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Reviews', robots: { index: false } }

export default async function ReviewQueue({ searchParams }: { searchParams: Promise<{ area?: string; level?: string; type?: string; q?: string; done?: string }> }) {
  await requireCoach('/coach/reviews')
  const f = await searchParams
  const p = await payload()
  const { docs: areas } = await p.find({ collection: 'pdr-areas', sort: 'order', depth: 0, limit: 20, overrideAccess: true })
  const { docs } = await p.find({
    collection: 'pdr-submissions',
    where: {
      status: { equals: 'pending' },
      ...(f.area ? { area: { equals: Number(f.area) } } : {}),
      ...(f.level ? { levelNumber: { equals: Number(f.level) } } : {}),
      ...(f.type ? { type: { equals: f.type } } : {}),
      ...(f.q ? { label: { like: f.q } } : {}),
    },
    sort: 'createdAt',
    depth: 1,
    limit: 200,
    overrideAccess: true,
  })
  const sel = 'border border-line bg-black/40 px-2 py-1.5 text-sm'
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">Reviews</h1>
        <p className="mt-3 text-muted">Foundation+ videos waiting for a coach — oldest first.</p>
      </div>
      {f.done && <p role="status" className="border border-emerald-400/40 p-3 text-sm text-emerald-200">Saved — the family has been emailed.</p>}
      <form className="flex flex-wrap gap-2">
        <select name="area" defaultValue={f.area ?? ''} className={sel} aria-label="Area"><option value="">All areas</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <select name="level" defaultValue={f.level ?? ''} className={sel} aria-label="Level"><option value="">All levels</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Level {n}</option>)}</select>
        <select name="type" defaultValue={f.type ?? ''} className={sel} aria-label="Type"><option value="">Attempts & feedback</option><option value="verification">Challenge attempts</option><option value="feedback">Feedback only</option></select>
        <input name="q" defaultValue={f.q ?? ''} placeholder="Player name" className={sel} />
        <button className="bg-white px-4 py-1.5 text-sm font-semibold text-black">Filter</button>
      </form>
      {docs.length === 0 ? (
        <p className="panel border border-line p-6 text-muted">Nothing waiting. 🎉</p>
      ) : (
        <ul className="divide-y divide-line border border-line">
          {docs.map((d) => {
            const kid = d.player as Participant
            const stage = d.stage as PdrStage
            const by = birthYearOf(kid.dateOfBirth)
            return (
              <li key={d.id}>
                <Link href={`/coach/reviews/${d.id}`} className="flex flex-wrap items-center justify-between gap-3 p-5 transition hover:bg-white/5">
                  <span>
                    <span className="font-semibold">{kid.firstName} {kid.lastName}</span> <span className="text-sm text-muted">{by ? groupLabel(by) : ''}</span>
                    <span className="block text-sm text-muted">{stage.code} — {stage.skillName}{d.claimedScore != null ? ` · says ${d.claimedScore} ${stage.criteria?.unit ?? ''}` : ''}</span>
                  </span>
                  <span className="text-right text-xs">
                    <span className={`px-2 py-0.5 font-semibold uppercase tracking-wider ${d.type === 'feedback' ? 'bg-sky-400/20 text-sky-200' : 'bg-white/10'}`}>{d.type === 'feedback' ? 'Feedback' : 'Attempt'}</span>
                    <span className="mt-1 block text-muted">{formatDate(d.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
