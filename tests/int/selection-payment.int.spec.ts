import { describe, expect, it } from 'vitest'
import { dueDate, feeFor, isOverdue, reminderDue } from '@/selections/payment'

const now = new Date('2027-02-01T00:00:00Z')
const DAY = 86_400_000
const due = (days: number) => new Date(now.getTime() + days * DAY).toISOString()

describe('paying after selection', () => {
  it('deadline is N days after the outcome', () => {
    expect(dueDate(now, 7)).toBe(due(7))
  })
  it('fee: squad override, then the round, then the program; Rowville uses the registration price', () => {
    expect(feeFor({ kind: 'tournament', fee: 250 }, { fee: 200 }, { price: 300 })).toBe(200)
    expect(feeFor({ kind: 'tournament', fee: 250 }, { fee: null }, { price: 300 })).toBe(250)
    expect(feeFor({ kind: 'rowville', fee: 99 }, { fee: 50 }, { price: 220 })).toBe(220)
  })
  it('sends each reminder once, when its day is reached', () => {
    const e = { status: 'selected' as const, paymentDueAt: due(5), remindersSent: [] as number[] }
    expect(reminderDue(e, [3, 1], now)).toBeNull()
    expect(reminderDue({ ...e, paymentDueAt: due(2.5) }, [3, 1], now)).toBe(3)
    expect(reminderDue({ ...e, paymentDueAt: due(2.5), remindersSent: [3] }, [3, 1], now)).toBeNull()
    expect(reminderDue({ ...e, paymentDueAt: due(0.5), remindersSent: [3] }, [3, 1], now)).toBe(1)
  })
  it('a late first run sends only the most urgent reminder', () => {
    expect(reminderDue({ status: 'selected', paymentDueAt: due(0.5), remindersSent: [] }, [3, 1], now)).toBe(1)
  })
  it('no reminders once paid, released, or past the deadline', () => {
    expect(reminderDue({ status: 'registered', paymentDueAt: due(1), remindersSent: [] }, [3, 1], now)).toBeNull()
    expect(reminderDue({ status: 'selected', paymentDueAt: due(-1), remindersSent: [] }, [3, 1], now)).toBeNull()
    expect(isOverdue({ status: 'offered', paymentDueAt: due(-1) }, now)).toBe(true)
  })
})
