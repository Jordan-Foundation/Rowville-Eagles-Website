import Link from 'next/link'
import { notFound } from 'next/navigation'
import { payload, formatDate } from '@/lib/payload'
import { requireCoach } from '@/academy/portal'
import { WEEKDAYS } from '@/academy/constants'
import { AvailabilityGrid } from '../AvailabilityGrid'

export const dynamic = 'force-dynamic'

export default async function TermAvailability({ params }: { params: Promise<{ termId: string }> }) {
  const { termId } = await params
  const { coach } = await requireCoach(`/coach/availability/${termId}`)
  const p = await payload()
  const term = await p.findByID({ collection: 'academy-terms', id: Number(termId), depth: 0, disableErrors: true })
  if (!term || term.status === 'draft') notFound()
  const { docs } = await p.find({ collection: 'academy-availability', where: { coach: { equals: coach.id }, term: { equals: term.id } }, limit: 1, depth: 0, overrideAccess: true })
  const mine = docs[0]
  const locked = !['availability', 'open'].includes(term.status)

  return (
    <div className="space-y-8">
      <Link href="/coach" className="text-sm text-muted hover:text-ink">← Overview</Link>
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">{term.name} availability</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Tap every hour you can coach a 1-on-1 <strong className="text-ink">every week</strong> from {formatDate(term.startDate)} to {formatDate(term.endDate)}. Sessions are{' '}
          {term.sessionMinutes} minutes. Families can book these times for the whole term or as one-off sessions.
        </p>
        <p className="mt-2 text-sm text-muted">
          {mine?.submittedAt ? `Submitted ${formatDate(mine.submittedAt)}.` : `Please submit by ${formatDate(term.availabilityDeadline, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}.`}
        </p>
        {(term.skipDates?.length ?? 0) > 0 && (
          <p className="mt-2 text-sm text-muted">No sessions on: {term.skipDates!.map((s) => formatDate(s.date, { day: 'numeric', month: 'short' }) + (s.reason ? ` (${s.reason})` : '')).join(', ')}.</p>
        )}
      </div>
      {locked && <p className="panel border border-line p-4 text-sm">This term is closed for changes. Contact the admin if you need to update your times.</p>}
      <AvailabilityGrid
        termId={term.id}
        weekdays={WEEKDAYS}
        times={(term.slotStartTimes ?? []).map((t) => t.time)}
        initial={(mine?.slots ?? []).map((s) => `${s.weekday} ${s.startTime}`)}
        submitted={Boolean(mine?.submittedAt)}
        locked={locked}
      />
    </div>
  )
}
