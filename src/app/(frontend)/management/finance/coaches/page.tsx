import Link from 'next/link'
import type { Metadata } from 'next'
import { payload } from '@/lib/payload'
import { localToUtc, localYmd } from '@/lib/time'
import { formatMoney } from '@/lib/format'
import { requireFinance } from '@/finance/access'
import { addDays, KIND_LABEL, mondayOf, rateOn } from '@/finance/rules'
import { coachList } from '@/finance/hours'
import { profilesByCoach, ratesByCoach, weekPay } from '@/finance/pay'
import { financeSettings } from '@/finance/settings'
import { addHours, payCancelled, removeAdjustment, saveProfile, setRate } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Finance · Coach hours & pay', robots: { index: false } }

type SP = { week?: string; coach?: string; done?: string; error?: string }
const btn = 'min-h-9 border border-line px-3 text-xs font-semibold uppercase tracking-[0.1em]'
const input = 'min-h-9 border border-line bg-surface px-2 text-sm'
const hm = (iso: string) => new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Melbourne', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
const day = (ymd: string) => new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${ymd}T00:00:00Z`))

/** Hours from sessions (with setup/pack-up per block), share-link bonuses, super and the week's pay — plus each coach's rate. */
export default async function CoachPay({ searchParams }: { searchParams: Promise<SP> }) {
  await requireFinance('/management/finance/coaches')
  const sp = await searchParams
  const p = await payload()
  const today = localYmd(new Date())
  const week = mondayOf(/^\d{4}-\d{2}-\d{2}$/.test(sp.week ?? '') ? sp.week! : today)
  const [w, coaches, rates, profiles, s] = await Promise.all([weekPay(p, week), coachList(p), ratesByCoach(p), profilesByCoach(p), financeSettings(p)])
  const qs = `week=${week}${sp.coach ? `&coach=${sp.coach}` : ''}`
  const focus = sp.coach ? w.coaches.find((c) => String(c.coach.id) === sp.coach) ?? null : null
  const focusCoach = sp.coach ? coaches.find((c) => String(c.id) === sp.coach) ?? null : null
  const { docs: adjustments } = focusCoach ? await p.find({ collection: 'coach-hour-adjustments', where: { and: [{ coach: { equals: focusCoach.id } }, { date: { greater_than_equal: week } }, { date: { less_than_equal: addDays(week, 6) } }] }, limit: 100, depth: 0, overrideAccess: true }) : { docs: [] }
  const { docs: cancelled } = focusCoach ? await p.find({ collection: 'academy-sessions', where: { and: [{ coach: { equals: focusCoach.id } }, { status: { equals: 'cancelled' } }, { startsAt: { greater_than_equal: localToUtc(week, '00:00').toISOString() } }, { startsAt: { less_than: localToUtc(addDays(week, 7), '00:00').toISOString() } }] }, limit: 50, depth: 0, overrideAccess: true }) : { docs: [] }
  const paidAlready = new Set(adjustments.filter((a) => a.kind === 'paid-cancellation').map((a) => a.sessionKey))

  return (
    <div className="space-y-10">
      {sp.done && <p role="status" className="border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm">{sp.done}</p>}
      {sp.error && <p role="alert" className="border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm">{sp.error}</p>}

      <section aria-labelledby="week-h" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="week-h" className="font-display text-2xl font-semibold uppercase">Week {day(week)} – {day(addDays(week, 6))}</h2>
          <div className="flex flex-wrap gap-2">
            <Link className={btn} href={`/management/finance/coaches?week=${addDays(week, -7)}`}>← Previous</Link>
            {week !== mondayOf(today) && <Link className={btn} href="/management/finance/coaches">This week</Link>}
            <Link className={btn} href={`/management/finance/coaches?week=${addDays(week, 7)}`}>Next →</Link>
            <a className={btn} href={`/management/finance/export/pay.xlsx?week=${week}`} download>Download XLSX (Xero)</a>
            <a className={btn} href={`/management/finance/export/pay.csv?week=${week}`} download>CSV</a>
          </div>
        </div>
        <p className="text-sm text-muted">Hours come from sessions that went ahead (cancelled ones don’t count unless marked paid), plus {s.setupMinutes} min setup and {s.packupMinutes} min pack-up per block of back-to-back sessions. Share-link bonus {s.bonusPct}% of what the customer paid per session. Super {s.superRate}% on top{s.superOnBonus ? ' (wages + bonus)' : ' (wages only)'}. The portal calculates pay — Xero handles tax and STP.</p>
        <div className="panel overflow-x-auto border border-line">
          <table className="w-full min-w-[760px] text-sm" aria-label="Pay this week">
            <thead><tr className="border-b border-line text-left text-muted"><th className="p-3 font-medium">Coach</th><th className="p-3 text-right font-medium">Hours</th><th className="p-3 text-right font-medium">Base pay</th><th className="p-3 text-right font-medium">Share-link bonus</th><th className="p-3 text-right font-medium">Gross</th><th className="p-3 text-right font-medium">Super</th><th className="p-3 text-right font-medium">Total cost</th></tr></thead>
            <tbody className="divide-y divide-line">
              {w.coaches.map((c) => (
                <tr key={c.coach.id} data-pay-row={c.coach.name}>
                  <td className="p-3"><Link className="underline" href={`/management/finance/coaches?week=${week}&coach=${c.coach.id}`}>{c.coach.name}</Link>{c.missingRate && <span className="ml-2 text-xs font-semibold text-amber-300">no rate set</span>}</td>
                  <td className="p-3 text-right tabular-nums">{c.hours.toFixed(2)}</td>
                  <td className="p-3 text-right tabular-nums">{formatMoney(c.base)}</td>
                  <td className="p-3 text-right tabular-nums">{formatMoney(c.bonus)}{c.bonusReversed ? <span className="block text-xs text-amber-300">−{formatMoney(c.bonusReversed)} reversed</span> : null}</td>
                  <td className="p-3 text-right tabular-nums">{formatMoney(c.gross)}</td>
                  <td className="p-3 text-right tabular-nums">{formatMoney(c.super)}</td>
                  <td className="p-3 text-right font-semibold tabular-nums">{formatMoney(c.total)}</td>
                </tr>
              ))}
              {!w.coaches.length && <tr><td colSpan={7} className="p-3 text-muted">No coaching hours this week.</td></tr>}
            </tbody>
            <tfoot><tr className="border-t border-line font-semibold" data-pay-total><td className="p-3">Total</td><td className="p-3 text-right">{w.totals.hours.toFixed(2)}</td><td className="p-3 text-right">{formatMoney(w.totals.base)}</td><td className="p-3 text-right">{formatMoney(w.totals.bonus)}</td><td className="p-3 text-right">{formatMoney(w.totals.gross)}</td><td className="p-3 text-right">{formatMoney(w.totals.super)}</td><td className="p-3 text-right">{formatMoney(w.totals.total)}</td></tr></tfoot>
          </table>
        </div>
      </section>

      {focusCoach && (
        <section aria-labelledby="coach-h" className="space-y-4" data-coach-detail>
          <h2 id="coach-h" className="font-display text-2xl font-semibold uppercase">{focusCoach.name} — this week</h2>
          <div className="panel overflow-x-auto border border-line">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-b border-line text-left text-muted"><th className="p-3 font-medium">Day</th><th className="p-3 font-medium">Time</th><th className="p-3 font-medium">Type</th><th className="p-3 font-medium">Client / program</th><th className="p-3 text-right font-medium">Hours</th><th className="p-3 text-right font-medium">Rate</th><th className="p-3 font-medium">Share link</th></tr></thead>
              <tbody className="divide-y divide-line">
                {(focus?.lines ?? []).map((l) => (
                  <tr key={l.key} data-line={l.kind} className={l.kind === 'setup_packup' ? 'text-muted' : ''}>
                    <td className="p-3">{day(l.date)}</td>
                    <td className="p-3">{l.kind === 'manual' ? '—' : `${hm(l.startsAt)}–${hm(l.endsAt)}`}</td>
                    <td className="p-3">{KIND_LABEL[l.kind]}{l.note ? <span className="block text-xs text-muted">{l.note}</span> : null}</td>
                    <td className="p-3">{l.client ?? ''}{l.venue ? <span className="block text-xs text-muted">{l.venue}</span> : null}</td>
                    <td className="p-3 text-right tabular-nums">{(l.minutes / 60).toFixed(2)}</td>
                    <td className="p-3 text-right tabular-nums">{l.rate == null ? '—' : formatMoney(l.rate)}</td>
                    <td className="p-3">{l.shareLink ? `✓ +${formatMoney(l.bonus)}` : ''}</td>
                  </tr>
                ))}
                {!focus?.lines.length && <tr><td colSpan={7} className="p-3 text-muted">No hours this week.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <form action={addHours} className="panel space-y-3 border border-line p-4 text-sm" aria-label="Add hours">
              <h3 className="font-semibold">Add or adjust hours</h3>
              <input type="hidden" name="qs" value={qs} /><input type="hidden" name="coach" value={focusCoach.id} />
              <div className="flex flex-wrap gap-3">
                <label className="grid gap-1">Date<input type="date" name="date" defaultValue={week} className={input} required /></label>
                <label className="grid gap-1">Start (optional)<input type="time" name="startTime" className={input} /></label>
                <label className="grid gap-1">Hours<input type="number" name="hours" step="0.25" className={`${input} w-24`} required /></label>
              </div>
              <label className="grid gap-1">Reason (kept in the audit log)<input name="reason" className={input} required placeholder="e.g. Equipment fit-out at the club rooms" /></label>
              <button className={btn}>Add hours</button>
              <p className="text-xs text-muted">Use a minus number (e.g. −0.5) to take time off a session.</p>
            </form>
            <div className="panel space-y-3 border border-line p-4 text-sm">
              <h3 className="font-semibold">Manual hours this week</h3>
              <ul className="divide-y divide-line">{adjustments.filter((a) => a.kind === 'manual').map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span>{day(a.date)} · {(a.minutes / 60).toFixed(2)}h · {a.reason}</span><form action={removeAdjustment}><input type="hidden" name="qs" value={qs} /><input type="hidden" name="id" value={a.id} /><button className="text-xs underline">Remove</button></form></li>
              ))}{!adjustments.some((a) => a.kind === 'manual') && <li className="py-2 text-muted">None.</li>}</ul>
              {cancelled.length > 0 && (
                <>
                  <h3 className="pt-2 font-semibold">Cancelled sessions</h3>
                  <ul className="divide-y divide-line">{cancelled.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span>{day(localYmd(new Date(c.startsAt)))} {hm(c.startsAt)} · cancelled{c.cancelledBy ? ` by ${c.cancelledBy}` : ''}</span>
                      {paidAlready.has(`as:${c.id}`) ? <span className="text-xs text-muted">Paid</span> : (
                        <form action={payCancelled} className="flex gap-2"><input type="hidden" name="qs" value={qs} /><input type="hidden" name="coach" value={focusCoach.id} /><input type="hidden" name="date" value={localYmd(new Date(c.startsAt))} /><input type="hidden" name="sessionKey" value={`as:${c.id}`} /><input name="reason" placeholder="Reason" className={`${input} w-40`} /><button className="text-xs underline">Pay anyway</button></form>
                      )}
                    </li>
                  ))}</ul>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="coaches-h" className="space-y-4">
        <h2 id="coaches-h" className="font-display text-2xl font-semibold uppercase">Coaches & rates</h2>
        <p className="text-sm text-muted">A new rate applies from its date — earlier weeks are always paid at the rate that applied then. Tick “Eagles” for coaches paid for Rowville Eagles team coaching.</p>
        <ul className="space-y-3">
          {coaches.map((c) => {
            const r = rates.get(c.id) ?? []
            const pr = profiles.get(c.id)
            const current = rateOn(r, today)
            return (
              <li key={c.id} className="panel border border-line p-4 text-sm" data-coach={c.name}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p><strong>{c.name}</strong> <span className="text-muted">· {c.active ? 'active' : 'inactive'} · {current == null ? <span className="font-semibold text-amber-300">no rate set</span> : `${formatMoney(current)}/h`}{r.length > 1 ? ` · ${r.length} rates on file` : ''}</span></p>
                  <Link href={`/management/finance/coaches?week=${week}&coach=${c.id}`} className="text-xs underline">Hours this week</Link>
                </div>
                <div className="mt-3 grid gap-4 lg:grid-cols-2">
                  <form action={setRate} className="flex flex-wrap items-end gap-2" aria-label={`Rate for ${c.name}`}>
                    <input type="hidden" name="qs" value={qs} /><input type="hidden" name="coach" value={c.id} />
                    <label className="grid gap-1">Hourly rate<input type="number" name="rate" step="0.01" min="0" defaultValue={current ?? ''} className={`${input} w-28`} required /></label>
                    <label className="grid gap-1">From<input type="date" name="from" defaultValue={today} className={input} required /></label>
                    <button className={btn}>Set rate</button>
                    {r.length > 0 && <span className="w-full text-xs text-muted">History: {[...r].reverse().map((x) => `${formatMoney(x.hourlyRate)} from ${x.effectiveFrom}`).join(' · ')}</span>}
                  </form>
                  <form action={saveProfile} className="flex flex-wrap items-end gap-3" aria-label={`Pay details for ${c.name}`}>
                    <input type="hidden" name="qs" value={qs} /><input type="hidden" name="coach" value={c.id} />
                    <label className="flex items-center gap-1"><input type="checkbox" name="superOn" defaultChecked={pr?.superOn !== false} /> Super</label>
                    <label className="flex items-center gap-1"><input type="checkbox" name="eaglesPaid" defaultChecked={Boolean(pr?.eaglesPaid)} /> Eagles</label>
                    <label className="flex items-center gap-1"><input type="checkbox" name="payrollActive" defaultChecked={pr?.payrollActive !== false} /> On pay run</label>
                    <label className="grid gap-1">Super fund<input name="superFund" defaultValue={pr?.superFund ?? ''} className={`${input} w-36`} /></label>
                    <label className="grid gap-1">Name in Xero<input name="xeroEmployee" defaultValue={pr?.xeroEmployee ?? ''} className={`${input} w-36`} /></label>
                    <label className="grid w-full gap-1">Notes<input name="notes" defaultValue={pr?.notes ?? ''} className={input} /></label>
                    <button className={btn}>Save</button>
                  </form>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
