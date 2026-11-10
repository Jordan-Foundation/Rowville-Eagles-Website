import Link from 'next/link'
import type { Metadata } from 'next'
import { requireManagement } from '@/lib/management'
import { payload } from '@/lib/payload'
import { localWeekdayTime, localYmd } from '@/lib/time'
import { HOLIDAY_ORDER, setupYear } from '@/academy/yearly'
import { loadSetup, publishPlan } from '@/academy/yearly-setup'
import { publishAction, saveAction, startAction } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Yearly setup', robots: { index: false } }

const input = 'min-h-10 border border-line bg-surface px-2 text-sm'
const fmt = (ymd?: string | null) => (ymd ? new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—')

/**
 * November: enter next year's Term 1–4 dates. The school holidays and coach availability deadlines
 * (3 weeks before each start) are worked out and can be changed; a summary shows what publishing creates.
 */
export default async function YearlySetupPage({ searchParams }: { searchParams: Promise<{ year?: string; done?: string; error?: string }> }) {
  await requireManagement('/management/yearly-setup')
  const sp = await searchParams
  const year = Number(sp.year) || setupYear(new Date())
  const p = await payload()
  const setup = await loadSetup(p, year)
  const hasDates = !!setup?.terms?.length
  const published = setup?.status === 'published'
  const plan = hasDates ? await publishPlan(p, setup!) : []
  const opens = setup?.term1OpensAt ? `${localYmd(new Date(setup.term1OpensAt))}T${localWeekdayTime(setup.term1OpensAt).time}` : ''
  const results = setup?.results as { timeframes?: { id: number; name: string; action: string }[]; programs?: { id: number; title: string; action: string; slots: number }[] } | null

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-tight">Yearly setup · {year}</h1>
        <p className="mt-2 text-muted">Enter the {year} school term dates. The school holidays and coach availability deadlines are worked out for you (change anything before publishing).</p>
        <p className="mt-2 flex gap-4 text-sm">
          <Link href={`/management/yearly-setup?year=${year - 1}`} className="underline">← {year - 1}</Link>
          <Link href={`/management/yearly-setup?year=${year + 1}`} className="underline">{year + 1} →</Link>
        </p>
      </div>
      {(sp.done || sp.error) && <p role={sp.error ? 'alert' : 'status'} className={`border p-4 text-sm ${sp.error ? 'border-red-400/40 text-red-200' : 'border-emerald-400/40 text-emerald-200'}`}>{sp.error ?? sp.done}</p>}

      {published ? (
        <section className="space-y-4">
          <p className="border border-emerald-400/40 p-4 text-sm text-emerald-200">{year} was published{setup?.publishedAt ? ` on ${new Date(setup.publishedAt).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'long', year: 'numeric' })}` : ''}. Change dates on <Link href="/management/dates" className="underline">Set dates</Link>.</p>
          <ul className="divide-y divide-line border border-line text-sm">
            {(results?.timeframes ?? []).map((t) => <li key={t.id} className="flex justify-between p-3"><Link href={`/admin/collections/academy-terms/${t.id}`} className="underline">{t.name}</Link><span className="text-muted">{t.action}</span></li>)}
            {(results?.programs ?? []).map((x) => <li key={x.id} className="flex justify-between p-3"><Link href={`/management/programs/setup/${x.id}`} className="underline">{x.title}</Link><span className="text-muted">{x.action}{x.slots ? ` · ${x.slots} training times copied` : ''}</span></li>)}
          </ul>
        </section>
      ) : !hasDates ? (
        <form action={startAction} className="panel space-y-4 border border-line p-5">
          <input type="hidden" name="year" value={year} />
          <h2 className="font-display text-2xl font-semibold uppercase">1. Term dates</h2>
          {[1, 2, 3, 4].map((n) => (
            <fieldset key={n} className="flex flex-wrap items-end gap-3">
              <legend className="w-full text-sm font-semibold">Term {n}</legend>
              <label className="text-sm">First day <input type="date" name={`t${n}start`} required className={input} aria-label={`Term ${n} first day`} /></label>
              <label className="text-sm">Last day <input type="date" name={`t${n}end`} required className={input} aria-label={`Term ${n} last day`} /></label>
            </fieldset>
          ))}
          <button className="min-h-11 bg-white px-5 text-sm font-semibold uppercase tracking-[0.15em] text-black">Work out the holidays</button>
        </form>
      ) : (
        <>
          <form action={saveAction} className="panel space-y-5 border border-line p-5">
            <input type="hidden" name="year" value={year} />
            <h2 className="font-display text-2xl font-semibold uppercase">2. Check the dates</h2>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted"><th className="py-2">Timeframe</th><th>First day</th><th>Last day</th><th>Coach availability due</th></tr></thead>
              <tbody>
                {setup!.terms!.map((t, i) => (
                  <tr key={`t${i}`} className="border-t border-line">
                    <th scope="row" className="py-2 text-left">Term {i + 1}</th>
                    <td><input type="date" name={`t${i + 1}start`} defaultValue={t.start ?? ''} aria-label={`Term ${i + 1} first day`} className={input} /></td>
                    <td><input type="date" name={`t${i + 1}end`} defaultValue={t.end ?? ''} aria-label={`Term ${i + 1} last day`} className={input} /></td>
                    <td><input type="date" name={`t${i + 1}deadline`} defaultValue={t.deadline ?? ''} aria-label={`Term ${i + 1} availability due`} className={input} /></td>
                  </tr>
                ))}
                {HOLIDAY_ORDER.map(({ period, label }) => {
                  const h = setup!.holidays?.find((x) => x.period === period)
                  return (
                    <tr key={period} className="border-t border-line">
                      <th scope="row" className="py-2 text-left">{label}</th>
                      <td><input type="date" name={`${period}start`} defaultValue={h?.start ?? ''} aria-label={`${label} first day`} className={input} /></td>
                      <td><input type="date" name={`${period}end`} defaultValue={h?.end ?? ''} aria-label={`${label} last day`} className={input} /></td>
                      <td><input type="date" name={`${period}deadline`} defaultValue={h?.deadline ?? ''} aria-label={`${label} availability due`} className={input} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="text-xs text-muted">Availability is due at 5pm on the day shown (3 weeks before each start by default). Coaches get reminders 2 weeks, 1 week, 3 days and 1 day before.</p>
            <label className="block text-sm">Term 1 and full-year registrations open <input type="datetime-local" name="term1OpensAt" defaultValue={opens} className={`${input} ml-2`} aria-label="Registrations open" /> <span className="text-xs text-muted">(blank = straight away when published)</span></label>
            <button className="min-h-11 border border-white/60 px-5 text-sm font-semibold uppercase tracking-[0.15em]">Save changes</button>
          </form>

          <section className="panel space-y-4 border border-line p-5">
            <h2 className="font-display text-2xl font-semibold uppercase">3. Summary</h2>
            <p className="text-sm text-muted">Publishing does this. Timeframes start collecting coach availability; the Academy term programs are created as drafts (open them when you’re ready).</p>
            <ul className="divide-y divide-line border border-line text-sm" aria-label="What publishing does">
              {plan.map((x) => (
                <li key={x.name} className="flex flex-wrap justify-between gap-2 p-3">
                  <span><span className="font-semibold">{x.name}</span> <span className="text-muted">· {x.detail}</span></span>
                  <span className={`text-xs font-semibold uppercase tracking-wider ${x.action === 'create' ? 'text-emerald-300' : x.action === 'update' ? 'text-amber-300' : 'text-muted'}`}>{x.action === 'create' ? 'Create' : x.action === 'update' ? 'Update dates' : 'Already set up'}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm">Term 1 and full-year registrations open: <strong>{setup!.term1OpensAt ? new Date(setup!.term1OpensAt).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'straight away'}</strong> <span className="text-muted">(automatic opening and announcements come in the next update)</span></p>
            <p className="text-sm text-muted">Term 1: {fmt(setup!.terms![0].start)} – {fmt(setup!.terms![0].end)} · Term 4 ends {fmt(setup!.terms![3].end)}</p>
            <form action={publishAction}>
              <input type="hidden" name="year" value={year} />
              <button className="min-h-11 bg-white px-5 text-sm font-semibold uppercase tracking-[0.15em] text-black">Publish {year}</button>
            </form>
          </section>
        </>
      )}
    </div>
  )
}
