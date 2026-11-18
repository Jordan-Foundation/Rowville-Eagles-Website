import Link from 'next/link'
import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { payload } from '@/lib/payload'
import { loadBookingHours } from '@/academy/hours-data'
import { startsIn } from '@/academy/hours'
import { toYmd } from '@/academy/term-dates'
import { saveBookingHours } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Booking hours', robots: { index: false } }

const input = 'min-h-10 border border-line bg-surface px-2'
const time12 = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 || h === 24 ? 'am' : 'pm'}`
}

/** Default 1-on-1 hours (school terms / holidays), closed dates, and the back-to-back booking rule. */
export default async function BookingHoursPage({ searchParams }: { searchParams: Promise<{ done?: string; error?: string }> }) {
  await requireManagement('/management/booking-hours')
  const sp = await searchParams
  const p = await payload()
  const [h, settings, { docs: coaches }] = await Promise.all([
    loadBookingHours(p),
    p.findGlobal({ slug: 'academy-settings', depth: 0, overrideAccess: true }),
    p.find({ collection: 'academy-coaches', where: { active: { equals: true } }, pagination: false, limit: 200, depth: 0, overrideAccess: true, sort: 'order', select: { displayName: true, backToBack: true } }),
  ])
  const closed = (settings.closedDates ?? []).map((c) => ({ date: toYmd(c.date), note: c.note ?? '' }))
  const today = new Date().toISOString().slice(0, 10)
  const upcomingTerms = h.terms.filter((t) => t.end >= today).slice(0, 5)
  const rows = [
    { key: 'termWeekday', label: 'School term · Monday–Friday', w: h.termWeekday },
    { key: 'termWeekend', label: 'School term · Saturday & Sunday', w: h.termWeekend },
    { key: 'holiday', label: 'School holidays · every day', w: h.holiday },
  ] as const
  const fmt = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Booking hours</h1>
        <p className="mt-2 text-muted">When families can book 1-on-1s. Sessions run back to back inside these hours, and a coach’s availability only counts inside them. Any date outside a school term uses the holiday hours.</p>
      </div>
      {sp.done && <p role="status" className="border border-line bg-white/5 p-3 text-sm">{sp.done}</p>}
      {sp.error && <p role="alert" className="border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{sp.error}</p>}
      <form action={saveBookingHours} className="space-y-8" aria-label="Booking hours">
        <section className="panel space-y-3 border border-line p-5">
          <h2 className="font-display text-2xl font-semibold uppercase">Hours</h2>
          {rows.map((r) => (
            <div key={r.key} className="flex flex-wrap items-center gap-3 text-sm" data-window={r.key}>
              <span className="w-64 font-semibold">{r.label}</span>
              <input type="time" name={`${r.key}From`} defaultValue={r.w.from} required aria-label={`${r.label} from`} className={input} /> to
              <input type="time" name={`${r.key}To`} defaultValue={r.w.to} required aria-label={`${r.label} until`} className={input} />
              <span className="text-xs text-muted">1-hour sessions: {startsIn(r.w, 60).map(time12).join(', ') || 'none'}</span>
            </div>
          ))}
          <p className="text-xs text-muted">
            School terms come from <Link href="/management/yearly-setup" className="underline">Yearly setup</Link> / <Link href="/management/dates" className="underline">Set dates</Link> (the Victorian school terms are used for any year not set up yet).
            {upcomingTerms.length > 0 && <> Next: {upcomingTerms.map((t) => `${fmt(t.start)} – ${fmt(t.end)}`).join(' · ')}.</>}
          </p>
        </section>

        <section className="panel space-y-3 border border-line p-5">
          <h2 className="font-display text-2xl font-semibold uppercase">Closed dates</h2>
          <p className="text-sm text-muted">No 1-on-1 times show on these days (e.g. Christmas Day). Leave a row blank to remove it.</p>
          <ul className="space-y-2" aria-label="Closed dates">
            {[...closed, { date: '', note: '' }, { date: '', note: '' }].map((c, i) => (
              <li key={i} className="flex flex-wrap gap-2 text-sm">
                <input type="date" name="closedDate" defaultValue={c.date} aria-label={`Closed date ${i + 1}`} className={input} />
                <input name="closedNote" defaultValue={c.note} placeholder="e.g. Christmas Day" aria-label={`Closed date ${i + 1} note`} className={`${input} flex-1`} />
              </li>
            ))}
          </ul>
        </section>

        <section className="panel space-y-3 border border-line p-5">
          <h2 className="font-display text-2xl font-semibold uppercase">Back-to-back booking</h2>
          <p className="text-sm text-muted">Once a coach has a booking on a day, families only see the times directly before and after it, so sessions fill up back to back. Management and coaches booking internally always see every time. Times are only hidden — availability isn’t changed.</p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={h.backToBack.enabled} /> Use back-to-back booking</label>
          <fieldset className="flex flex-wrap gap-4 text-sm">
            <legend className="mb-1 w-full text-xs uppercase tracking-wider text-muted">Applies to</legend>
            {([['casual', 'One-off 1-on-1s'], ['term', 'Weekly 1-on-1s for the term'], ['pack', 'Holiday packs']] as const).map(([v, l]) => (
              <label key={v} className="flex items-center gap-2"><input type="checkbox" name="appliesTo" value={v} defaultChecked={h.backToBack.appliesTo.includes(v)} /> {l}</label>
            ))}
          </fieldset>
          <label className="block text-sm">Show every time again <input type="number" name="releaseHours" min={0} max={336} defaultValue={h.backToBack.releaseHours} aria-label="Release window hours" className={`${input} mx-2 w-20`} /> hours before the day starts <span className="text-xs text-muted">(0 = off)</span></label>
          {coaches.length > 0 && (
            <fieldset className="text-sm">
              <legend className="mb-1 text-xs uppercase tracking-wider text-muted">Switch off for a coach</legend>
              <div className="flex flex-wrap gap-4">
                {coaches.map((c) => (
                  <label key={c.id} className="flex items-center gap-2"><input type="checkbox" name="coachOff" value={c.id} defaultChecked={c.backToBack === false} /> {c.displayName}</label>
                ))}
              </div>
            </fieldset>
          )}
        </section>
        <button className="min-h-11 bg-white px-5 text-sm font-semibold uppercase tracking-[0.15em] text-black">Save</button>
      </form>
    </div>
  )
}
