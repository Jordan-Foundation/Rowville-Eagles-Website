import { DownloadCsv } from '@/components/management/DownloadCsv'
import Link from 'next/link'
import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { payload } from '@/lib/payload'
import { managementSearch, type Hit } from '@/lib/management-search'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Search', robots: { index: false } }

const TITLES: Record<Hit['kind'], string> = { family: 'Families', player: 'Players', booking: 'Bookings & references' }

export default async function ManagementSearch({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireManagement('/management/search')
  const term = ((await searchParams).q ?? '').trim()
  const hits = await managementSearch(await payload(), term)
  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Find a family or player</h1>
        <div className="mt-3 flex flex-wrap gap-2"><DownloadCsv list="families" label="All families (CSV)" /><DownloadCsv list="players" label="All players (CSV)" /></div>
        <form className="mt-4 flex flex-wrap gap-2" role="search">
          <input name="q" type="search" defaultValue={term} autoFocus placeholder="Name, email, mobile or booking reference" aria-label="Search" className="min-h-11 w-full max-w-md border border-line bg-black/40 px-3" />
          <button className="min-h-11 bg-white px-5 text-sm font-semibold uppercase tracking-[0.12em] text-black">Search</button>
        </form>
        <p className="mt-2 text-xs text-muted">Try “Smith”, “ava smith”, “0412 345 678”, “jo@example.com” or “RFA-7K3QX9”.</p>
      </div>
      {term.length >= 2 && hits.length === 0 && <p className="text-muted">Nothing found for “{term}”.</p>}
      {(['family', 'player', 'booking'] as const).map((k) => {
        const list = hits.filter((h) => h.kind === k)
        if (!list.length) return null
        return (
          <section key={k} aria-label={TITLES[k]}>
            <h2 className="font-display text-xl font-semibold uppercase">{TITLES[k]} ({list.length})</h2>
            <ul className="mt-3 divide-y divide-line border border-line">
              {list.map((h) => (
                <li key={h.href + h.title}>
                  <Link href={h.href} className="block p-4 hover:bg-white/5">
                    <span className="font-semibold">{h.title}</span>
                    <span className="block text-sm text-muted">{h.detail}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
