import Link from 'next/link'
import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { payload, formatDate } from '@/lib/payload'
import { DownloadCsv } from '@/components/management/DownloadCsv'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Activity', robots: { index: false } }

type Change = { label: string; from: string; to: string }

/** Who changed which price, date, promotion or setting, and when. */
export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  await requireManagement('/management/activity')
  const area = (await searchParams).area ?? ''
  const p = await payload()
  const { docs } = await p.find({ pagination: false, collection: 'activity-log', where: area ? { area: { equals: area } } : {}, sort: '-createdAt', limit: 300, depth: 0, overrideAccess: true })
  const areas = ['Programs', 'Academy terms', 'Shop', 'Promotions', 'Player reports', 'Selections', 'Teams', 'Club settings']
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Activity</h1>
        <p className="mt-2 text-muted">Every change to prices, dates, promotions and key settings — from Management pages or the admin — with who made it.</p>
        <div className="mt-3"><DownloadCsv list="activity" params={{ area }} /></div>
      </div>
      <nav aria-label="Area" className="flex flex-wrap gap-2 text-sm">
        {['', ...areas].map((a) => <Link key={a || 'all'} href={a ? `/management/activity?area=${encodeURIComponent(a)}` : '/management/activity'} className={`min-h-10 border px-3 py-2 ${area === a ? 'border-white bg-white text-black' : 'border-line text-muted hover:text-ink'}`}>{a || 'Everything'}</Link>)}
      </nav>
      {docs.length === 0 ? <p className="text-muted">No changes recorded yet.</p> : (
        <ol className="divide-y divide-line border border-line">
          {docs.map((d) => (
            <li key={d.id} className="p-4 text-sm">
              <p><span className="font-semibold">{d.what}</span> <span className="text-muted">· {d.area} · {d.action} by {d.byName || 'system'} · {formatDate(d.createdAt, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span></p>
              <ul className="mt-1 space-y-0.5">
                {((d.changes as Change[] | null) ?? []).map((c, i) => <li key={i}><span className="text-muted">{c.label}:</span> {c.from} <span aria-hidden>→</span><span className="sr-only">changed to</span> <strong>{c.to}</strong></li>)}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
