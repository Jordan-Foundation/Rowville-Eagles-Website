import Link from 'next/link'
import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { requireManagement } from '@/lib/management'
import { upcomingTrials } from '@/academy/trial-list'
import { TrialsList } from '@/components/management/TrialsList'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Upcoming RFA trials', robots: { index: false } }

/** Every booked RFA trial player, by day (next 14 days, or all). */
export default async function TrialsPage({ searchParams }: { searchParams: Promise<{ all?: string; session?: string }> }) {
  await requireManagement('/management/trials')
  const sp = await searchParams
  const all = sp.all === '1' || Boolean(sp.session)
  const sessions = await upcomingTrials(await payload(), { days: all ? null : 14 })
  return (
    <div className="max-w-4xl space-y-6 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-semibold uppercase">Upcoming RFA trials</h1>
          <p className="mt-1 text-sm text-muted">{all ? 'All booked trials' : 'Next 14 days'} · {sessions.reduce((n, s) => n + s.players.length, 0)} players in {sessions.length} session{sessions.length === 1 ? '' : 's'}</p>
        </div>
        <Link href={all ? '/management/trials' : '/management/trials?all=1'} className="text-sm underline">{all ? 'Next 14 days only' : 'See all'}</Link>
      </header>
      <section className="panel border border-line"><TrialsList sessions={sessions} highlight={sp.session} /></section>
      <p className="text-xs text-muted">Management gets a phone notification 1 day, 3 hours and 15 minutes before each session with trial players (choose who in Settings → Academy settings → RFA trial reminders).</p>
    </div>
  )
}
