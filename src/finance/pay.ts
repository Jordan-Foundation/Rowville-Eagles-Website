import type { Payload } from 'payload'
import { addDays, bonusFor, payForCoach, r2, type CoachPay, type HourLine } from './rules'
import { coachList, hourLines, type Coach } from './hours'
import { financeSettings } from './settings'

const q = { overrideAccess: true, pagination: false } as const
const idOf = (v: unknown): number | null => (v && typeof v === 'object' ? ((v as { id?: number }).id ?? null) : typeof v === 'number' ? v : null)

export type CoachWeek = CoachPay & { coach: Coach; lines: (HourLine & { bonus: number; rate: number | null })[]; superOn: boolean; xeroName: string; reversedKeys: string[] }
export type WeekPay = { weekStart: string; weekEnd: string; coaches: CoachWeek[]; totals: { hours: number; base: number; bonus: number; gross: number; super: number; total: number } }

export async function ratesByCoach(p: Payload) {
  const { docs } = await p.find({ ...q, collection: 'coach-pay-rates', limit: 5000, depth: 0, sort: 'effectiveFrom' })
  const by = new Map<number, { hourlyRate: number; effectiveFrom: string }[]>()
  for (const r of docs) {
    const c = idOf(r.coach)
    if (c) by.set(c, [...(by.get(c) ?? []), { hourlyRate: r.hourlyRate, effectiveFrom: r.effectiveFrom }])
  }
  return by
}

export async function profilesByCoach(p: Payload) {
  const { docs } = await p.find({ ...q, collection: 'coach-pay-profiles', limit: 1000, depth: 0 })
  return new Map(docs.map((d) => [idOf(d.coach)!, d]))
}

/**
 * Share-link bonuses counted in earlier reported weeks whose session has since been cancelled or refunded,
 * and not already taken back — they come off this week.
 */
async function reversalsDue(p: Payload, weekStart: string) {
  const { docs: weeks } = await p.find({ ...q, collection: 'pay-weeks', where: { weekStart: { less_than: weekStart } }, limit: 500, depth: 0 })
  const counted = new Map<string, { coachId: number; amount: number }>()
  const reversed = new Set<string>()
  for (const w of weeks) {
    for (const [k, v] of Object.entries((w.bonusKeys ?? {}) as Record<string, { coachId: number; amount: number }>)) counted.set(k, v)
    for (const k of (w.reversedKeys ?? []) as string[]) reversed.add(k)
  }
  const sessionIds = [...counted.keys()].filter((k) => !reversed.has(k) && k.startsWith('as:')).map((k) => Number(k.slice(3)))
  if (!sessionIds.length) return new Map<string, { coachId: number; amount: number }>()
  const { docs: sessions } = await p.find({ ...q, collection: 'academy-sessions', where: { id: { in: sessionIds } }, limit: 20000, depth: 1, select: { status: true, booking: true } })
  const due = new Map<string, { coachId: number; amount: number }>()
  for (const id of sessionIds) {
    const s = sessions.find((x) => x.id === id)
    const booking = s && typeof s.booking === 'object' ? s.booking : null
    const gone = !s || s.status === 'cancelled' || booking?.status === 'refunded'
    if (gone) due.set(`as:${id}`, counted.get(`as:${id}`)!)
  }
  return due
}

/** One week of pay (Monday `weekStart` to Sunday), every coach with time that week. */
export const weekPay = (p: Payload, weekStart: string) => periodPay(p, weekStart, addDays(weekStart, 6), { reversals: true })

/** Pay for any range of local dates (a week, a month…). Reversals of earlier bonuses only apply to pay weeks. */
export async function periodPay(p: Payload, weekStart: string, weekEnd: string, o: { reversals?: boolean } = {}): Promise<WeekPay> {
  const [s, coaches, rates, profiles, lines, reversals] = await Promise.all([financeSettings(p), coachList(p), ratesByCoach(p), profilesByCoach(p), hourLines(p, weekStart, weekEnd), o.reversals ? reversalsDue(p, weekStart) : Promise.resolve(new Map<string, { coachId: number; amount: number }>())])
  const pay = { superRate: s.superRate, superOnBonus: s.superOnBonus, bonusPct: s.bonusPct }
  const out: CoachWeek[] = []
  for (const coach of coaches) {
    const mine = lines.filter((l) => l.coachId === coach.id)
    const rev = [...reversals].filter(([, v]) => v.coachId === coach.id)
    if (!mine.length && !rev.length) continue
    const profile = profiles.get(coach.id)
    const r = rates.get(coach.id) ?? []
    const totals = payForCoach(coach.id, mine, r, pay, { superOn: profile?.superOn !== false, reversals: rev.reduce((n, [, v]) => n + v.amount, 0) })
    out.push({
      ...totals,
      coach,
      superOn: profile?.superOn !== false,
      xeroName: profile?.xeroEmployee || coach.name,
      reversedKeys: rev.map(([k]) => k),
      lines: mine.map((l) => ({ ...l, bonus: bonusFor(l, s.bonusPct), rate: r.filter((x) => x.effectiveFrom <= l.date).at(-1)?.hourlyRate ?? null })),
    })
  }
  const sum = (k: 'hours' | 'base' | 'bonus' | 'gross' | 'super' | 'total') => r2(out.reduce((n, c) => n + (k === 'bonus' ? c.bonus - c.bonusReversed : c[k]), 0))
  return { weekStart, weekEnd, coaches: out, totals: { hours: sum('hours'), base: sum('base'), bonus: sum('bonus'), gross: sum('gross'), super: sum('super'), total: sum('total') } }
}

/** Saves the week as reported: per-coach totals plus which bonuses were counted (so later refunds can reverse them). */
export async function snapshotWeek(p: Payload, w: WeekPay) {
  const bonusKeys: Record<string, { coachId: number; amount: number }> = {}
  for (const c of w.coaches) for (const l of c.lines) if (l.bonus > 0) bonusKeys[l.key] = { coachId: c.coach.id, amount: l.bonus }
  const data = {
    weekStart: w.weekStart,
    weekEnd: w.weekEnd,
    generatedAt: new Date().toISOString(),
    coaches: w.coaches.map((c) => ({ coachId: c.coach.id, name: c.coach.name, hours: c.hours, base: c.base, bonus: c.bonus, bonusReversed: c.bonusReversed, gross: c.gross, super: c.super, total: c.total })),
    bonusKeys,
    reversedKeys: w.coaches.flatMap((c) => c.reversedKeys),
  }
  const { docs } = await p.find({ ...q, collection: 'pay-weeks', where: { weekStart: { equals: w.weekStart } }, limit: 1, depth: 0 })
  if (docs[0]) return p.update({ collection: 'pay-weeks', id: docs[0].id, data, overrideAccess: true, depth: 0 })
  return p.create({ collection: 'pay-weeks', data, overrideAccess: true, depth: 0 })
}
