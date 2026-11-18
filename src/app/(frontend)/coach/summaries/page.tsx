import Link from 'next/link'
import type { Metadata } from 'next'
import { requireCoach } from '@/academy/portal'
import { payload } from '@/lib/payload'
import { lastSummariesFor, pendingSummaries } from '@/academy/summaries/service'
import { FOCUS } from '@/academy/summaries/Collection'
import { pushKeys } from '@/push/send'
import { PushToggle } from '@/components/coach/PushToggle'
import { SummaryForm } from './SummaryForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Session summaries', robots: { index: false } }

const when = (iso: string) => new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))

/** One link for all of a coach's summaries: one session at a time, Save & next. */
export default async function SummariesPage({ searchParams }: { searchParams: Promise<{ done?: string; total?: string; skip?: string; s?: string }> }) {
  const { coach } = await requireCoach('/coach/summaries')
  const sp = await searchParams
  const p = await payload()
  const pending = await pendingSummaries(p, { coachId: coach.id })
  const skip = new Set((sp.skip ?? '').split(',').filter(Boolean).map(Number))
  const done = Number(sp.done) || 0
  const total = Math.max(Number(sp.total) || 0, pending.length + done)
  const queue = pending.filter((x) => !skip.has(x.sessionId))
  const current = queue.find((x) => String(x.sessionId) === sp.s) ?? queue[0]
  const { publicKey } = await pushKeys(p)

  if (!current) {
    return (
      <div className="max-w-2xl space-y-6">
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Session summaries</h1>
        <p className="border border-line p-5 text-lg" role="status" data-summaries-done>{done ? `✓ All done — ${done} summar${done === 1 ? 'y' : 'ies'} sent to families. Thanks!` : skip.size ? 'You’ve skipped the rest for now.' : 'Nothing to write — you’re all caught up.'}</p>
        {skip.size > 0 && <Link href="/coach/summaries" className="text-sm underline">Go back to the ones you skipped</Link>}
        <PushToggle publicKey={publicKey} />
      </div>
    )
  }

  const step = done + 1
  // What this player was working on last time (also what a cover coach needs)
  const { docs: rows } = await p.find({ collection: 'academy-sessions', where: { id: { in: current.players.map((x) => x.sessionId) } }, limit: 20, depth: 0, overrideAccess: true, pagination: false, select: { booking: true } })
  const bookingIds = rows.map((r) => (typeof r.booking === 'object' ? r.booking?.id : r.booking)).filter((x): x is number => typeof x === 'number')
  const previous = current.kind === 'one-on-one' ? (await lastSummariesFor(p, bookingIds, current.at, 1))[0] : null
  const skipNext = [...skip, current.sessionId].join(',')

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Session summaries</h1>
        <p className="text-sm text-muted" data-step>Session {Math.min(step, total)} of {total}</p>
      </div>
      <div className="h-1.5 w-full bg-white/10"><div className="h-full bg-white" style={{ width: `${(done / Math.max(1, total)) * 100}%` }} /></div>
      <PushToggle publicKey={publicKey} compact />
      <section className="panel border border-line p-5" aria-label="This session">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">{current.kind === 'group' ? 'Small group' : '1-on-1'}</p>
        <h2 className="mt-1 text-xl font-semibold" data-summary-title>{current.kind === 'group' ? current.players.map((x) => x.name).join(', ') : current.players[0]?.name}</h2>
        <p className="text-sm text-muted">{when(current.at)}</p>
        {previous && (
          <div className="mt-3 border-t border-line pt-3 text-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Last time</p>
            {previous.nextSteps && <p className="mt-1"><span className="text-muted">Next steps: </span>{previous.nextSteps}</p>}
            {previous.privateNotes && <p className="mt-1"><span className="text-muted">Coach notes: </span>{previous.privateNotes}</p>}
          </div>
        )}
        <div className="mt-5">
          <SummaryForm key={current.sessionId} sessionId={current.sessionId} focus={FOCUS} players={current.players} group={current.kind === 'group'} done={done} total={total} skip={[...skip].join(',')} last={queue.length === 1} />
        </div>
      </section>
      {queue.length > 1 && <p className="text-sm"><Link href={`/coach/summaries?done=${done}&total=${total}&skip=${skipNext}`} className="underline">Skip this one for now →</Link></p>}
    </div>
  )
}
