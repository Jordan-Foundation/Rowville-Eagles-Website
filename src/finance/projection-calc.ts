/**
 * Projections — pure maths shared by the server (baseline) and the browser (what-if sliders). Unit-tested.
 * Nothing here touches real data: a scenario only changes numbers on screen.
 */

export const PROGRAMS = ['academy', 'oneOnOne', 'smallGroup', 'camps', 'registrations', 'other'] as const
export type Program = (typeof PROGRAMS)[number]
export const PROGRAM_LABEL: Record<Program, string> = { academy: 'Academy & Mini Ballers', oneOnOne: '1-on-1s', smallGroup: 'Small groups', camps: 'Holiday camps', registrations: 'Eagles registrations', other: 'Other' }

export type Week = {
  week: string // Monday YYYY-MM-DD
  actual: boolean
  revenue: Record<Program, number>
  /** Of which already booked/paid (the rest is expected from trends). */
  known: number
  coaching: number
  expenses: number
}

export type Baseline = {
  weeks: Week[]
  today: string
  academyPlayers: number // players in the latest term (baseline for the slider)
  avgRate: number // average hourly rate (for extra hours)
  superRate: number
  terms: { name: string; start: string; end: string }[]
}

export type Scenario = {
  academyPlayers?: number | null
  priceChange?: Partial<Record<Program, number>> // % per program
  extraHoursPerWeek?: number
  campAttendancePct?: number // 100 = as expected
  oneOff?: { amount: number; date: string } | null
}

const r2 = (n: number) => Math.round(n * 100) / 100
export const weekRevenue = (w: Week) => r2(PROGRAMS.reduce((n, k) => n + (w.revenue[k] ?? 0), 0))

/** Applies a scenario to future weeks only (actuals never change). */
export function applyScenario(b: Baseline, s: Scenario): Week[] {
  const playerScale = s.academyPlayers != null && b.academyPlayers > 0 ? s.academyPlayers / b.academyPlayers : 1
  const camp = (s.campAttendancePct ?? 100) / 100
  const extraCost = (s.extraHoursPerWeek ?? 0) * b.avgRate * (1 + b.superRate / 100)
  return b.weeks.map((w) => {
    if (w.actual) return w
    const revenue = { ...w.revenue }
    for (const k of PROGRAMS) {
      let v = revenue[k] ?? 0
      if (k === 'academy') v *= playerScale
      if (k === 'camps') v *= camp
      v *= 1 + (s.priceChange?.[k] ?? 0) / 100
      revenue[k] = r2(v)
    }
    const oneOff = s.oneOff && s.oneOff.amount > 0 && s.oneOff.date >= w.week && s.oneOff.date < addDays(w.week, 7) ? s.oneOff.amount : 0
    return { ...w, revenue, coaching: r2(w.coaching + extraCost), expenses: r2(w.expenses + oneOff) }
  })
}

export const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export type Totals = { revenue: number; costs: number; profit: number }
/** Totals for future weeks starting before `until` (and on/after `from`). */
export function totals(weeks: Week[], from: string, until: string): Totals {
  const ws = weeks.filter((w) => !w.actual && w.week >= from && w.week < until)
  const revenue = r2(ws.reduce((n, w) => n + weekRevenue(w), 0))
  const costs = r2(ws.reduce((n, w) => n + w.coaching + w.expenses, 0))
  return { revenue, costs, profit: r2(revenue - costs) }
}

/** The rest of the current term (or the next one, in the holidays): actuals so far + projection to its end. */
export function termTotals(weeks: Week[], b: Pick<Baseline, 'terms' | 'today'>): (Totals & { name: string }) | null {
  const t = b.terms.find((x) => x.end >= b.today) ?? null
  if (!t) return null
  const ws = weeks.filter((w) => w.week >= mondayOf(t.start) && w.week <= t.end)
  const revenue = r2(ws.reduce((n, w) => n + weekRevenue(w), 0))
  const costs = r2(ws.reduce((n, w) => n + w.coaching + w.expenses, 0))
  return { name: t.name, revenue, costs, profit: r2(revenue - costs) }
}

export function mondayOf(ymd: string) {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

/** Plain-language headline, e.g. “On track for about $4,200 profit this term”. */
export function headline(t: Totals & { name?: string }, label: string) {
  const amt = Math.round(Math.abs(t.profit) / 100) * 100
  const money = `$${amt.toLocaleString('en-AU')}`
  return t.profit >= 0 ? `On track for about ${money} profit ${label}` : `Heading for about a ${money} loss ${label}`
}
