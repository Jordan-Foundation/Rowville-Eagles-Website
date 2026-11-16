import type { Payload } from 'payload'
import { CATEGORY_LABEL, moneyEntries, summarise } from '../lib/money'
import { localToUtc, localYmd, TZ } from '../lib/time'
import { paymentsMode, stripeFor } from '../lib/stripe-accounts'
import { sendEmail } from '../lib/email'
import { emailLayout, esc } from '../lib/email-templates'
import { siteUrl } from '../lib/payments'
import { formatMoney } from '../lib/format'
import { addDays, pctOf, previousWeek, r2, reportDue } from './rules'
import { weekPay, snapshotWeek, type WeekPay } from './pay'
import { payWorkbook } from './export'
import { financeSettings } from './settings'

const q = { overrideAccess: true, pagination: false } as const

/** Local dates → ISO instants for [from 00:00, to 23:59:59.999] (daylight saving handled by the zone). */
export const periodIso = (fromYmd: string, toYmd: string) => ({ from: localToUtc(fromYmd, '00:00').toISOString(), to: new Date(localToUtc(addDays(toYmd, 1), '00:00').getTime() - 1).toISOString() })

/** Foundation+ subscription payments (billed by Stripe directly, so not in the site's own payment records). */
export async function foundationPlusIncome(fromIso: string, toIso: string): Promise<number | null> {
  if (paymentsMode('academy') !== 'stripe') return null
  try {
    let total = 0
    for await (const inv of stripeFor('academy').invoices.list({ status: 'paid', created: { gte: Math.floor(Date.parse(fromIso) / 1000), lte: Math.floor(Date.parse(toIso) / 1000) }, limit: 100 })) {
      if ((inv as { subscription?: unknown }).subscription || inv.billing_reason?.startsWith('subscription')) total += (inv.amount_paid ?? 0) / 100
    }
    return r2(total)
  } catch {
    return null
  }
}

export async function revenueFor(p: Payload, fromYmd: string, toYmd: string) {
  const { from, to } = periodIso(fromYmd, toYmd)
  const s = summarise(await moneyEntries(p, new Date(Date.parse(from) - 400 * 86_400_000).toISOString()), from, to)
  const fplus = await foundationPlusIncome(from, to)
  const lines = s.lines.map((l) => ({ label: CATEGORY_LABEL[l.category], gross: l.gross, refunds: l.refunds, net: l.net }))
  if (fplus) lines.push({ label: 'Foundation+ (Stripe subscriptions)', gross: fplus, refunds: 0, net: fplus })
  const gross = r2(lines.reduce((n, l) => n + l.gross, 0))
  const refunds = r2(lines.reduce((n, l) => n + l.refunds, 0))
  return { lines, gross, refunds, net: r2(gross - refunds) }
}

export async function expensesFor(p: Payload, fromYmd: string, toYmd: string) {
  const { docs } = await p.find({ ...q, collection: 'expenses', where: { and: [{ date: { greater_than_equal: fromYmd } }, { date: { less_than_equal: toYmd } }] }, limit: 5000, depth: 1 })
  const by = new Map<string, number>()
  for (const e of docs) {
    const name = typeof e.category === 'object' && e.category ? e.category.name : 'Uncategorised'
    by.set(name, r2((by.get(name) ?? 0) + e.amount))
  }
  return { total: r2(docs.reduce((n, e) => n + e.amount, 0)), byCategory: [...by].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount), count: docs.length }
}

export async function attentionItems(p: Payload) {
  const [unmatched, review, noReceipt] = await Promise.all([
    p.count({ collection: 'bank-transactions', where: { and: [{ status: { equals: 'unmatched' } }, { direction: { equals: 'debit' } }] }, overrideAccess: true }),
    p.count({ collection: 'expenses', where: { status: { equals: 'needs_review' } }, overrideAccess: true }),
    p.count({ collection: 'expenses', where: { receipt: { exists: false } }, overrideAccess: true }),
  ])
  return { unmatchedDebits: unmatched.totalDocs, needsReview: review.totalDocs, missingReceipts: noReceipt.totalDocs }
}

export type WeekSummary = {
  start: string
  end: string
  revenue: Awaited<ReturnType<typeof revenueFor>>
  pay: { coaches: { name: string; hours: number; base: number; bonus: number; super: number; total: number }[]; totals: WeekPay['totals'] }
  expenses: Awaited<ReturnType<typeof expensesFor>>
  coachingPct: number | null
  net: number
}

export async function weekSummary(p: Payload, start: string, w?: WeekPay): Promise<WeekSummary> {
  const end = addDays(start, 6)
  const [revenue, pay, expenses] = await Promise.all([revenueFor(p, start, end), w ? Promise.resolve(w) : weekPay(p, start), expensesFor(p, start, end)])
  return {
    start, end, revenue, expenses,
    pay: { coaches: pay.coaches.map((c) => ({ name: c.coach.name, hours: c.hours, base: c.base, bonus: r2(c.bonus - c.bonusReversed), super: c.super, total: c.total })), totals: pay.totals },
    coachingPct: pctOf(pay.totals.total, revenue.net),
    net: r2(revenue.net - pay.totals.total - expenses.total),
  }
}

/** The same week of the previous school term (by week number from the term's first day), if both terms exist. */
async function sameWeekLastTerm(p: Payload, start: string): Promise<string | null> {
  const { docs: terms } = await p.find({ ...q, collection: 'academy-terms', where: { category: { not_equals: 'school-holidays' } }, sort: 'startDate', limit: 100, depth: 0 })
  const i = terms.findIndex((t) => t.startDate && t.endDate && localYmd(new Date(t.startDate)) <= start && localYmd(new Date(t.endDate)) >= start)
  if (i <= 0) return null
  const cur = terms[i]
  const prev = terms[i - 1]
  const weeks = Math.round((Date.parse(`${start}T00:00:00Z`) - Date.parse(`${localYmd(new Date(cur.startDate!))}T00:00:00Z`)) / (7 * 86_400_000))
  const d = new Date(`${localYmd(new Date(prev.startDate!))}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + weeks * 7)
  return d.toISOString().slice(0, 10)
}

export type ReportData = WeekSummary & { previous: { net: number; revenue: number; coaching: number; expenses: number } | null; lastTerm: { start: string; net: number; revenue: number; coaching: number; expenses: number } | null; attention: Awaited<ReturnType<typeof attentionItems>> }

export async function buildReport(p: Payload, start: string, w?: WeekPay): Promise<ReportData> {
  const cur = await weekSummary(p, start, w)
  const brief = (x: WeekSummary) => ({ net: x.net, revenue: x.revenue.net, coaching: x.pay.totals.total, expenses: x.expenses.total })
  const prev = await weekSummary(p, addDays(start, -7)).then(brief).catch(() => null)
  const lt = await sameWeekLastTerm(p, start)
  const lastTerm = lt ? await weekSummary(p, lt).then((x) => ({ start: lt, ...brief(x) })).catch(() => null) : null
  return { ...cur, previous: prev, lastTerm, attention: await attentionItems(p) }
}

const delta = (a: number, b: number | undefined) => (b === undefined ? '' : ` (${a - b >= 0 ? '+' : '−'}${formatMoney(Math.abs(r2(a - b)))} vs ${'last week'})`)

function reportHtml(d: ReportData) {
  const day = (ymd: string) => new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${ymd}T00:00:00Z`))
  const cmp = (label: string, cur: number, prev?: number, last?: number) => `${formatMoney(cur)}${prev !== undefined ? ` · last week ${formatMoney(prev)}` : ''}${last !== undefined ? ` · same week last term ${formatMoney(last)}` : ''}`
  return emailLayout('club', [
    {
      heading: `Week ${day(d.start)} – ${day(d.end)}`,
      intro: `Net result for the week: <strong>${formatMoney(d.net)}</strong>${delta(d.net, d.previous?.net).replace('last week', 'last week')}.`,
      rows: [
        ['Revenue (net of refunds)', cmp('rev', d.revenue.net, d.previous?.revenue, d.lastTerm?.revenue)],
        ['Coaching cost (incl. super)', cmp('coach', d.pay.totals.total, d.previous?.coaching, d.lastTerm?.coaching)],
        ['Coaching cost as % of revenue', d.coachingPct == null ? '—' : `${d.coachingPct}%`],
        ['Expenses', cmp('exp', d.expenses.total, d.previous?.expenses, d.lastTerm?.expenses)],
      ],
    },
    { heading: 'Revenue by program', intro: d.revenue.lines.length ? '' : 'No payments this week.', rows: [...d.revenue.lines.map((l) => [esc(l.label), `${formatMoney(l.net)}${l.refunds ? ` (after ${formatMoney(l.refunds)} refunds)` : ''}`] as [string, string]), ['Total refunds', formatMoney(d.revenue.refunds)], ['Net revenue', formatMoney(d.revenue.net)]] },
    { heading: 'Coaches', intro: d.pay.coaches.length ? 'Hours · base · share-link bonus · super · total' : 'No coaching hours.', rows: [...d.pay.coaches.map((c) => [esc(c.name), `${c.hours.toFixed(2)}h · ${formatMoney(c.base)} · ${formatMoney(c.bonus)} · ${formatMoney(c.super)} · <strong>${formatMoney(c.total)}</strong>`] as [string, string]), ['Total', `${d.pay.totals.hours.toFixed(2)}h · ${formatMoney(d.pay.totals.total)}`]], after: 'The pay summary is attached as a spreadsheet (with a sheet laid out for Xero Payroll).' },
    { heading: 'Expenses', intro: d.expenses.byCategory.length ? '' : 'No expenses recorded this week.', rows: d.expenses.byCategory.map((c) => [esc(c.category), formatMoney(c.amount)] as [string, string]) },
    { heading: 'Needs attention', intro: d.attention.unmatchedDebits + d.attention.needsReview + d.attention.missingReceipts ? '' : 'Nothing — all caught up.', rows: [['Bank debits without a receipt', String(d.attention.unmatchedDebits)], ['Expenses to review', String(d.attention.needsReview)], ['Expenses missing a receipt file', String(d.attention.missingReceipts)]], cta: { label: 'Open Finance', href: `${siteUrl()}/management/finance` } },
  ])
}

async function recipients(p: Payload) {
  const s = await financeSettings(p)
  if (s.reportRecipients.length) return s.reportRecipients
  const { docs } = await p.find({ ...q, collection: 'users', where: { roles: { in: ['admin'] } }, limit: 20, depth: 0 })
  return docs.map((u) => u.email).filter(Boolean)
}

/** Build, save and email the report for the week starting `start`. `force` re-sends a week already sent. */
export async function sendFinanceReport(p: Payload, start: string, o: { force?: boolean; to?: string[] } = {}) {
  const { docs } = await p.find({ ...q, collection: 'finance-reports', where: { periodStart: { equals: start } }, limit: 1, depth: 0 })
  if (docs[0]?.sentAt && !o.force) return { sent: false, already: true }
  const w = await weekPay(p, start)
  const data = await buildReport(p, start, w)
  await snapshotWeek(p, w)
  const to = o.to ?? (await recipients(p))
  const xlsx = await payWorkbook(w)
  for (const email of to) {
    await sendEmail(p, { to: email, sender: 'club', kind: 'service', subject: `Weekly finance report — week of ${start}: net ${formatMoney(data.net)}`, html: reportHtml(data), attachments: [{ filename: `coach-pay-${start}.xlsx`, content: xlsx }] })
  }
  const saved = { periodStart: start, periodEnd: data.end, data: data as unknown as Record<string, unknown>, sentAt: new Date().toISOString(), sentTo: to.join(', ') }
  if (docs[0]) await p.update({ collection: 'finance-reports', id: docs[0].id, data: saved, ...q, depth: 0 })
  else await p.create({ collection: 'finance-reports', data: saved, ...q, depth: 0 })
  return { sent: true, to: to.length }
}

function localNow(now: Date) {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, weekday: 'short', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  return { weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.find((x) => x.type === 'weekday')?.value ?? 'Mon'), hour: Number(parts.find((x) => x.type === 'hour')?.value ?? 0) }
}

/** Hourly: on the set day and hour (Monday 9am Melbourne by default), send last week's report once. */
export async function runWeeklyFinanceReport(p: Payload, now = new Date()) {
  const s = await financeSettings(p)
  if (!reportDue(localNow(now), { day: s.reportDay, hour: s.reportHour })) return { due: false }
  const { start } = previousWeek(localYmd(now))
  return { due: true, week: start, ...(await sendFinanceReport(p, start)) }
}

