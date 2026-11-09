import Link from 'next/link'
import type { Metadata } from 'next'
import { requireCoach } from '@/academy/portal'
import { payload, formatDate } from '@/lib/payload'
import { todayYmd, trainingDay } from '@/academy/training-day'
import { ContactButtons, MedicalBadge } from '@/components/coach/ContactButtons'
import { formatPhone } from '@/lib/phone'
import { AttendanceSheet } from './AttendanceSheet'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Training day', robots: { index: false } }

const shift = (ymd: string, n: number) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

/** The training-day screen: every group and team training the coach runs today, with rosters and attendance. */
export default async function TrainingDay({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { user, coach } = await requireCoach('/coach/today')
  const raw = (await searchParams).date
  const today = todayYmd()
  const ymd = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today
  const p = await payload()
  const { blocks, oneOnOnes } = await trainingDay(p, user, coach, ymd)
  const label = formatDate(`${ymd}T02:00:00Z`, { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-muted">{ymd === today ? 'Today' : 'Training day'}</p>
        <h1 className="mt-1 font-display text-4xl font-semibold uppercase tracking-tight sm:text-5xl">{label}</h1>
        <nav aria-label="Change day" className="mt-4 flex flex-wrap gap-2 text-sm">
          <Link href={`/coach/today?date=${shift(ymd, -1)}`} className="border border-line px-3 py-2">← Previous day</Link>
          {ymd !== today && <Link href="/coach/today" className="border border-line px-3 py-2">Today</Link>}
          <Link href={`/coach/today?date=${shift(ymd, 1)}`} className="border border-line px-3 py-2">Next day →</Link>
        </nav>
      </div>

      {blocks.length === 0 && oneOnOnes.length === 0 && <p className="panel border border-line p-6 text-muted">Nothing on this day.</p>}

      {oneOnOnes.length > 0 && (
        <section className="panel border border-line">
          <h2 className="border-b border-line p-5 font-display text-xl font-semibold uppercase">1-on-1s</h2>
          <ul className="divide-y divide-line">
            {oneOnOnes.map(({ session, booking }) => (
              <li key={session.id}>
                <Link href={`/coach/sessions/${session.id}`} className="flex items-center justify-between gap-4 p-5 hover:bg-white/5">
                  <span><strong>{formatDate(session.startsAt, { hour: 'numeric', minute: '2-digit' })}</strong> · {booking.player.firstName} {booking.player.lastName}{booking.player.medical?.trim() && <span className="ml-2 bg-red-600 px-1.5 py-0.5 text-[11px] font-bold uppercase text-white">Medical</span>}</span>
                  <span className="text-xs uppercase tracking-[0.15em] text-muted">Open →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {blocks.map((b) => (
        <section key={b.key} className="panel gloss-sheen border border-line" aria-label={b.title}>
          <div className="border-b border-line p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">{b.subtitle}</p>
            <h2 className="mt-1 font-display text-2xl font-semibold uppercase">{formatDate(b.startsAt, { hour: 'numeric', minute: '2-digit' })} · {b.title}</h2>
            <p className="mt-1 text-sm text-muted">
              {b.rows.length} player{b.rows.length === 1 ? '' : 's'}
              {b.rows.some((r) => r.medical?.trim()) && <> · <span className="font-semibold text-red-300">{b.rows.filter((r) => r.medical?.trim()).length} with medical notes</span></>}
              {b.takenAt && <> · attendance saved {formatDate(b.takenAt, { hour: 'numeric', minute: '2-digit' })}</>}
            </p>
            <p className="mt-3"><Link href={`/coach/broadcast?to=${encodeURIComponent(b.kind === 'team' ? `team:${b.key.split(':')[1]}` : `group:${b.key.split(':')[1]}:${b.key.split(':')[2]}`)}`} className="text-sm font-semibold underline">Message these families</Link></p>
          </div>
          <AttendanceSheet
            id={b.key}
            initial={b.present}
            rows={b.rows.map((r) => ({
              id: r.id,
              name: r.name,
              details: (
                <>
                  <MedicalBadge note={r.medical} />
                  {r.emergency && <p className="mt-1 text-sm text-muted">Emergency: {r.emergency.replace(/(\d[\d\s]{7,})$/, (m) => formatPhone(m))}</p>}
                  {r.noPhotos && <p className="text-xs font-semibold text-amber-300">No photos</p>}
                  <div className="mt-2"><ContactButtons name={r.parent.name} phone={r.parent.phone} accountId={r.parent.accountId} /></div>
                </>
              ),
            }))}
          />
        </section>
      ))}
    </div>
  )
}
