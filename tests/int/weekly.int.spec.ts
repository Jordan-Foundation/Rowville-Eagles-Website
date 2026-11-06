import { describe, expect, it } from 'vitest'
import { nextChargeAt, weeklyPlan } from '@/academy/weekly'
import { datesOnWeekday, localToUtc } from '@/lib/time'

const H = 3600_000
const tuesdays = (from: string, to: string) => datesOnWeekday(from, to, 'Tuesday').map((d) => localToUtc(d, '17:00').toISOString())

describe('weekly payment plan', () => {
  const sessions = tuesdays('2027-02-02', '2027-03-30') // 9 Tuesdays at 5pm Sydney
  const now = new Date('2027-02-01T00:00:00Z')
  const plan = weeklyPlan(sessions, now)!

  it('charges session 1 now and one automatic charge per later session', () => {
    expect(plan.recurringCharges).toBe(8)
    expect(plan.chargeDates).toHaveLength(9)
    expect(plan.chargeDates[0]).toBe(now.toISOString())
  })
  it('charges each later session 48 hours before it starts', () => {
    plan.chargeDates.slice(1).forEach((c, i) => expect(new Date(sessions[i + 1]).getTime() - new Date(c).getTime()).toBe(48 * H))
    expect(plan.anchor * 1000).toBe(new Date(plan.chargeDates[1]).getTime())
  })
  it('cancels after the final charge and before another would be taken', () => {
    const last = new Date(plan.chargeDates.at(-1)!).getTime()
    expect(plan.cancelAt * 1000).toBeGreaterThan(last)
    expect(plan.cancelAt * 1000).toBeLessThan(last + 7 * 24 * H)
  })
  it('keeps every charge 1–3 days ahead across a daylight-saving change', () => {
    const spring = tuesdays('2027-09-21', '2027-10-26') // DST starts Sun 3 Oct 2027
    const p = weeklyPlan(spring, new Date('2027-09-19T00:00:00Z'))!
    p.chargeDates.slice(1).forEach((c, i) => {
      const lead = new Date(spring[i + 1]).getTime() - new Date(c).getTime()
      expect(lead).toBeGreaterThanOrEqual(24 * H)
      expect(lead).toBeLessThanOrEqual(72 * H)
    })
  })
  it('needs at least two sessions', () => {
    expect(weeklyPlan(sessions.slice(0, 1), now)).toBeNull()
  })
  it('works out the next charge from how many are paid', () => {
    expect(nextChargeAt(plan, 1)).toBe(plan.chargeDates[1])
    expect(nextChargeAt(plan, 8)).toBe(plan.chargeDates[8])
    expect(nextChargeAt(plan, 9)).toBeNull()
  })
})
