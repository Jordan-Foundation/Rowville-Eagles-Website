import type { Payload } from 'payload'
import { moneyEntries, summarise, type Category } from '../lib/money'
import { localYmd } from '../lib/time'
import { addDays, mondayOf, payForCoach, r2, type HourLine } from './rules'
import { hourLines } from './hours'
import { profilesByCoach, ratesByCoach } from './pay'
import { financeSettings } from './settings'
import { periodIso } from './report'
import { PROGRAMS, type Baseline, type Program, type Week } from './projection-calc'

/**
 * The projection baseline: the last 12 weeks as they happened, and the next 52 weeks from
 * (1) what's already booked or paid — scheduled 1-on-1s/small groups, paid term registrations spread over the term,
 *     paid camp places in the camp's week — and (2) recent trends for the rest. Coach costs come from the sessions
 *     already scheduled (with each coach's rate, setup/pack-up and super), topped up to the recent average for
 *     1-on-1s/small groups; expenses from recurring ones plus the recent average of the rest.
 */

const q = { overrideAccess: true, pagination: false } as const
const PROGRAM_OF: Record<Category, Program> = { 'one-on-one': 'oneOnOne', 'small-group': 'smallGroup', 'academy-terms': 'academy', camps: 'camps', trials: 'other', registrations: 'registrations', tournaments: 'other', shop: 'other', invoices: 'other' }
const empty = (): Record<Program, number> => Object.fromEntries(PROGRAMS.map((k) => [k, 0])) as Record<Program, number>
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

export async function projectionBaseline(p: Payload): Promise<Baseline> {
  const today = localYmd(new Date())
  const thisWeek = mondayOf(today)
  const pastWeeks = Array.from({ length: 12 }, (_, i) => addDays(thisWeek, -7 * (12 - i)))
  const futureWeeks = Array.from({ length: 52 }, (_, i) => addDays(thisWeek, 7 * i))
  const weekOf = (ymd: string) => mondayOf(ymd)
  const [s, rates, profiles] = await Promise.all([financeSettings(p), ratesByCoach(p), profilesByCoach(p)])
  const pay = { superRate: s.superRate, superOnBonus: s.superOnBonus, bonusPct: s.bonusPct }

  // ── Actuals ──
  const entries = await moneyEntries(p, new Date(Date.parse(periodIso(pastWeeks[0], pastWeeks[0]).from) - 400 * 86_400_000).toISOString())
  const coachCost = (lines: HourLine[]) => {
    const by = new Map<number, HourLine[]>()
    for (const l of lines) by.set(l.coachId, [...(by.get(l.coachId) ?? []), l])
    return r2([...by].reduce((n, [c, ls]) => n + payForCoach(c, ls, rates.get(c) ?? [], pay, { superOn: profiles.get(c)?.superOn !== false }).total, 0))
  }
  const pastLines = await hourLines(p, pastWeeks[0], addDays(thisWeek, -1))
  const { docs: pastExpenses } = await p.find({ ...q, collection: 'expenses', where: { date: { greater_than_equal: pastWeeks[0] } }, limit: 10000, depth: 0 })
  const sessionKinds = new Set(['one-on-one', 'small-group'])
  const actual: Week[] = pastWeeks.map((w) => {
    const { from, to } = periodIso(w, addDays(w, 6))
    const sum = summarise(entries, from, to)
    const revenue = empty()
    for (const l of sum.lines) revenue[PROGRAM_OF[l.category]] = r2(revenue[PROGRAM_OF[l.category]] + l.net)
    const lines = pastLines.filter((l) => weekOf(l.date) === w)
    return { week: w, actual: true, revenue, known: 0, coaching: coachCost(lines), expenses: r2(pastExpenses.filter((e) => weekOf(e.date) === w).reduce((n, e) => n + e.amount, 0)) }
  })
  const recent = actual.slice(-8)
  const trend = Object.fromEntries(PROGRAMS.map((k) => [k, avg(recent.map((w) => w.revenue[k]))])) as Record<Program, number>
  const sessionCostAvg = avg(recent.map((w) => coachCost(pastLines.filter((l) => weekOf(l.date) === w.week && (sessionKinds.has(l.kind) || (l.kind === 'setup_packup' && pastLines.some((x) => x.blockId === l.blockId && sessionKinds.has(x.kind))))))))
  const academyAvg = avg(actual.map((w) => w.revenue.academy).filter((x) => x > 0))

  // ── Known future income ──
  const known = new Map<string, Record<Program, number>>(futureWeeks.map((w) => [w, empty()]))
  const add = (ymd: string, k: Program, v: number) => { const w = known.get(weekOf(ymd)); if (w && v > 0) w[k] = r2(w[k] + v) }
  const end = addDays(futureWeeks.at(-1)!, 6)
  const { docs: sessions } = await p.find({ ...q, collection: 'academy-sessions', where: { and: [{ status: { equals: 'scheduled' } }, { kind: { in: ['one-on-one', 'group-player'] } }, { startsAt: { greater_than_equal: periodIso(thisWeek, thisWeek).from } }, { startsAt: { less_than_equal: periodIso(end, end).to } }] }, limit: 20000, depth: 1 })
  for (const x of sessions) {
    const b = typeof x.booking === 'object' ? x.booking : null
    if (b) add(localYmd(new Date(x.startsAt)), x.kind === 'group-player' ? 'smallGroup' : 'oneOnOne', (b.amount ?? 0) / Math.max(1, b.sessionsTotal || 1))
  }
  const { docs: regs } = await p.find({ ...q, collection: 'academy-registrations', where: { status: { equals: 'paid' } }, limit: 20000, depth: 1 })
  let academyPlayers = 0
  let latestStart = ''
  for (const r of regs) {
    const prog = typeof r.program === 'object' ? r.program : null
    if (!prog?.startDate || !prog.endDate) continue
    const ps = localYmd(new Date(prog.startDate))
    const pe = localYmd(new Date(prog.endDate))
    if (ps > latestStart && ps <= today) { latestStart = ps; academyPlayers = 0 }
    if (ps === latestStart) academyPlayers++
    if (pe < thisWeek) continue
    const weeks = futureWeeks.filter((w) => w >= mondayOf(ps) && w <= pe)
    const total = Math.max(1, Math.round((Date.parse(pe) - Date.parse(ps)) / (7 * 86_400_000)) + 1)
    for (const w of weeks) add(w, 'academy', (r.amount ?? 0) / total)
  }
  const { docs: campBookings } = await p.find({ ...q, collection: 'bookings', where: { status: { equals: 'paid' } }, limit: 20000, depth: 1 })
  const campRevenue = new Map<number, { start: string; total: number }>()
  for (const b of campBookings) {
    const prog = typeof b.program === 'object' ? b.program : null
    if (prog?.type !== 'holiday-camp' || !prog.startDate) continue
    const c = campRevenue.get(prog.id) ?? { start: localYmd(new Date(prog.startDate)), total: 0 }
    c.total += b.amount ?? 0
    campRevenue.set(prog.id, c)
  }
  const pastCamps = [...campRevenue.values()].filter((c) => c.start < thisWeek && c.start >= addDays(today, -365)).map((c) => c.total)
  const { docs: futureCamps } = await p.find({ ...q, collection: 'programs', where: { and: [{ type: { equals: 'holiday-camp' } }, { startDate: { greater_than_equal: periodIso(thisWeek, thisWeek).from } }] }, limit: 100, depth: 0 })

  // ── Terms (for “this term”, and where academy income is expected) ──
  const { docs: termDocs } = await p.find({ ...q, collection: 'academy-terms', where: { category: { not_equals: 'school-holidays' } }, sort: 'startDate', limit: 100, depth: 0 })
  const terms = termDocs.filter((t) => t.startDate && t.endDate).map((t) => ({ name: t.name, start: localYmd(new Date(t.startDate!)), end: localYmd(new Date(t.endDate!)) })).filter((t) => t.end >= addDays(today, -120))
  const inTerm = (w: string) => terms.some((t) => w >= mondayOf(t.start) && w <= t.end)

  // ── Future coaching and expenses ──
  const futureLines = await hourLines(p, thisWeek, end, { includeFuture: true })
  const { docs: recurring } = await p.find({ ...q, collection: 'expenses', where: { recurring: { equals: true } }, sort: '-date', limit: 500, depth: 0 })
  const monthly = [...new Map(recurring.map((e) => [e.supplier.toLowerCase(), e.amount])).values()].reduce((a, b) => a + b, 0)
  const variable = avg(pastWeeks.map((w) => pastExpenses.filter((e) => !e.recurring && weekOf(e.date) === w).reduce((n, e) => n + e.amount, 0)))
  const weeklyExpenses = r2((monthly * 12) / 52 + variable)

  const future: Week[] = futureWeeks.map((w) => {
    const k = known.get(w)!
    const revenue = empty()
    revenue.oneOnOne = r2(Math.max(k.oneOnOne, trend.oneOnOne))
    revenue.smallGroup = r2(Math.max(k.smallGroup, trend.smallGroup))
    revenue.academy = r2(Math.max(k.academy, inTerm(w) ? academyAvg : 0))
    const campsThisWeek = futureCamps.filter((c) => c.startDate && mondayOf(localYmd(new Date(c.startDate))) === w)
    revenue.camps = r2(campsThisWeek.reduce((n, c) => n + Math.max(campRevenue.get(c.id)?.total ?? 0, avg(pastCamps)), 0) + (campsThisWeek.length ? 0 : k.camps))
    revenue.registrations = r2(Math.max(k.registrations, trend.registrations))
    revenue.other = r2(trend.other)
    const lines = futureLines.filter((l) => weekOf(l.date) === w)
    const scheduled = coachCost(lines)
    const scheduledSessions = coachCost(lines.filter((l) => sessionKinds.has(l.kind) || (l.kind === 'setup_packup' && lines.some((x) => x.blockId === l.blockId && sessionKinds.has(x.kind)))))
    const knownTotal = r2(PROGRAMS.reduce((n, x) => n + k[x], 0) + campsThisWeek.reduce((n, c) => n + (campRevenue.get(c.id)?.total ?? 0), 0))
    return { week: w, actual: false, revenue, known: knownTotal, coaching: r2(scheduled + Math.max(0, sessionCostAvg - scheduledSessions)), expenses: weeklyExpenses }
  })

  const allRates = [...rates.values()].map((rs) => rs.at(-1)?.hourlyRate).filter((x): x is number => typeof x === 'number')
  return { weeks: [...actual, ...future], today, academyPlayers, avgRate: r2(avg(allRates)), superRate: s.superRate, terms }
}

