import Link from 'next/link'
import { notFound } from 'next/navigation'
import { payload, formatDate } from '@/lib/payload'
import { requireCoach } from '@/academy/portal'
import { WEEKDAYS, startTimesFor } from '@/academy/constants'
import { termDatesForWeekday, toYmd } from '@/academy/term-dates'
import { AvailabilityGrid } from '../AvailabilityGrid'
import { AwayPeriods } from '../AwayPeriods'

export const dynamic = 'force-dynamic'

export default async function TermAvailability({ params }: { params: Promise<{ termId: string }> }) {
  const { termId } = await params
  const { coach } = await requireCoach(`/coach/availability/${termId}`)
  const p = await payload()
  const term = await p.findByID({ collection: 'academy-terms', id: Number(termId), depth: 0, disableErrors: true })
  if (!term || term.status === 'draft') notFound()
  const { docs } = await p.find({ pagination: false, collection: 'academy-availability', where: { coach: { equals: coach.id }, term: { equals: term.id } }, limit: 1, depth: 0, overrideAccess: true })
  const mine = docs[0]
  const locked = !['availability', 'open'].includes(term.status)
  const allowed = Object.fromEntries(WEEKDAYS.map((d) => [d, startTimesFor(term, d)]))
  const times = Array.from(new Set(Object.values(allowed).flat())).sort()
  const counts = WEEKDAYS.map((d) => `${d.slice(0, 3)} ${termDatesForWeekday(term, d).length}`).join(' · ')
  const fmtDay = (iso: string) => formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div className="space-y-8">
      <Link href="/coach" className="text-sm text-muted hover:text-ink">← Overview</Link>
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">{term.name} availability</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Tap every hour you can coach a 1-on-1 <strong className="text-ink">every week</strong> from {formatDate(term.startDate)} to {formatDate(term.endDate)}. Sessions are{' '}
          {term.sessionMinutes} minutes, and you’re available on public holidays unless you add them as an away period below. Families can book these times for the whole term or as one-off sessions.
        </p>
        <p className="mt-2 text-sm text-muted">
          {mine?.submittedAt ? `Submitted ${formatDate(mine.submittedAt)}.` : `Please submit by ${formatDate(term.availabilityDeadline, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}.`}
        </p>
        <p className="mt-2 text-xs uppercase tracking-wider text-muted">Sessions this term: {counts}</p>
      </div>
      {locked && <p className="panel border border-line p-4 text-sm">This term is closed for changes. Contact the admin if you need to update your times.</p>}
      <AvailabilityGrid
        termId={term.id}
        weekdays={WEEKDAYS}
        times={times}
        allowed={allowed}
        initial={(mine?.slots ?? []).filter((s) => allowed[s.weekday]?.includes(s.startTime)).map((s) => `${s.weekday} ${s.startTime}`)}
        submitted={Boolean(mine?.submittedAt)}
        locked={locked}
      />
      <AwayPeriods
        termId={term.id}
        locked={locked}
        min={toYmd(term.startDate)}
        max={toYmd(term.endDate)}
        periods={(mine?.awayPeriods ?? []).map((a) => ({
          from: a.from,
          to: a.to,
          note: a.note,
          label: toYmd(a.from) === toYmd(a.to) ? fmtDay(a.from) : `${fmtDay(a.from)} – ${fmtDay(a.to)}`,
        }))}
      />
    </div>
  )
}
