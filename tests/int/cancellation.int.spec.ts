import { describe, expect, it } from 'vitest'
import { quoteCancellation, splitReturn, type QuoteSession } from '@/academy/cancellation'

const now = new Date('2027-02-01T00:00:00Z')
const H = 3600_000
const at = (hours: number) => new Date(now.getTime() + hours * H).toISOString()
const weeks = (n: number, paid = n, startHours = 48): QuoteSession[] =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, startsAt: at(startHours + i * 168), status: 'scheduled', paid: i < paid }))

const casual = { type: 'casual' as const, paymentMode: 'casual' as const, amount: 85, sessionsTotal: 1 }
const term = { type: 'term' as const, paymentMode: 'upfront' as const, amount: 720, sessionsTotal: 9 }
const weekly = { type: 'term' as const, paymentMode: 'weekly' as const, amount: 720, sessionsTotal: 9, sessionsPaid: 3 }

describe('cancellation policy — family', () => {
  it('casual 24h+ ahead: full refund or credit', () => {
    const q = quoteCancellation({ booking: casual, sessions: weeks(1, 1, 30), cancel: 'booking', by: 'family', now })
    expect(q).toMatchObject({ value: 85, options: ['refund', 'credit'], sessionsBack: 1 })
  })
  it('casual inside 24h: nothing back', () => {
    const q = quoteCancellation({ booking: casual, sessions: weeks(1, 1, 20), cancel: 'booking', by: 'family', now })
    expect(q).toMatchObject({ value: 0, options: ['none'] })
    expect(q.rule).toMatch(/less than 24 hours/)
  })
  it('whole term upfront: unplayed less one', () => {
    const played = [{ id: 99, startsAt: at(-100), status: 'completed', paid: true }]
    const q = quoteCancellation({ booking: term, sessions: [...played, ...weeks(6)], cancel: 'booking', by: 'family', now })
    expect(q).toMatchObject({ sessionIds: [1, 2, 3, 4, 5, 6], sessionsBack: 5, value: 400, stopWeekly: false })
  })
  it('whole term with one session left: nothing back', () => {
    expect(quoteCancellation({ booking: term, sessions: weeks(1), cancel: 'booking', by: 'family', now }).value).toBe(0)
  })
  it('weekly plan: only already-charged unplayed sessions, less one, and charges stop', () => {
    // 3 paid so far; 2 played, so 1 paid-but-unplayed + 6 unpaid to come
    const sessions = [
      { id: 90, startsAt: at(-300), status: 'completed', paid: true },
      { id: 91, startsAt: at(-130), status: 'completed', paid: true },
      ...weeks(7, 1),
    ]
    const q = quoteCancellation({ booking: weekly, sessions, cancel: 'booking', by: 'family', now })
    expect(q).toMatchObject({ sessionsBack: 0, value: 0, stopWeekly: true })
  })
  it('one week of a term 24h+ ahead comes back; the plan carries on', () => {
    const q = quoteCancellation({ booking: term, sessions: weeks(6), cancel: [3], by: 'family', now })
    expect(q).toMatchObject({ sessionIds: [3], value: 80, stopWeekly: false })
  })
  it('an uncharged weekly session still comes back (as credit) because the plan will charge it', () => {
    const q = quoteCancellation({ booking: { ...weekly, sessionsPaid: 1 }, sessions: weeks(7, 1), cancel: [4], by: 'family', now })
    expect(q.value).toBe(80)
    expect(q.warnings.join()).toMatch(/hasn’t been charged yet/)
  })
  it('never returns more than was paid', () => {
    const q = quoteCancellation({ booking: { ...casual, refundedAmount: 50 }, sessions: weeks(1, 1, 30), cancel: 'booking', by: 'family', now })
    expect(q).toMatchObject({ value: 35, refundableCash: 35, maxReturn: 35 })
  })
  it('sessions that already started can’t be cancelled', () => {
    const q = quoteCancellation({ booking: term, sessions: [{ id: 5, startsAt: at(-1), status: 'scheduled', paid: true }], cancel: [5], by: 'family', now })
    expect(q.sessionIds).toEqual([])
    expect(q.warnings[0]).toMatch(/already started/)
  })
})

describe('cancellation policy — coach', () => {
  it('coach cancels inside 24h: make-up or full value', () => {
    const q = quoteCancellation({ booking: casual, sessions: weeks(1, 1, 5), cancel: 'booking', by: 'coach', now })
    expect(q).toMatchObject({ value: 85, options: ['makeup', 'refund', 'credit'] })
  })
  it('coach ends a weekly plan: only charged weeks come back', () => {
    const q = quoteCancellation({ booking: weekly, sessions: weeks(7, 2), cancel: 'booking', by: 'coach', now })
    expect(q).toMatchObject({ sessionsBack: 2, value: 160, stopWeekly: true })
  })
})

describe('refund vs credit split', () => {
  it('refunds to card up to what is refundable, the rest as session credits', () => {
    expect(splitReturn({ outcome: 'refund', amount: 160, sessions: 2, refundableCash: 80, perSession: 80 })).toEqual({ cash: 80, creditSessions: 1 })
    expect(splitReturn({ outcome: 'refund', amount: 85, sessions: 1, refundableCash: 85, perSession: 85 })).toEqual({ cash: 85, creditSessions: 0 })
  })
  it('credit is whole sessions, never dollars', () => {
    expect(splitReturn({ outcome: 'credit', amount: 400, sessions: 5, refundableCash: 720, perSession: 80 })).toEqual({ cash: 0, creditSessions: 5 })
    expect(splitReturn({ outcome: 'makeup', amount: 85, sessions: 1, refundableCash: 85, perSession: 85 })).toEqual({ cash: 0, creditSessions: 0 })
  })
  it('a $70 term-member session cancelled early comes back as one session credit', () => {
    const q = quoteCancellation({ booking: { ...casual, amount: 70 }, sessions: weeks(1, 1, 30), cancel: 'booking', by: 'family', now })
    expect(q).toMatchObject({ value: 70, creditSessions: 1, options: ['refund', 'credit'] })
  })
  it('whole term less one gives that many session credits', () => {
    const q = quoteCancellation({ booking: term, sessions: weeks(6), cancel: 'booking', by: 'family', now })
    expect(q.creditSessions).toBe(5)
  })
})
