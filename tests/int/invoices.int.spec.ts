import { describe, expect, it } from 'vitest'
import { invoiceProblem, invoiceTotal, isOverdue, lineTotal } from '@/invoices/totals'
import { localYmd } from '@/lib/time'

describe('invoice totals', () => {
  it('adds quantity × price to the cent', () => {
    expect(lineTotal({ quantity: 3, unitPrice: 0.1 })).toBe(0.3)
    expect(invoiceTotal([{ quantity: 1, unitPrice: 85 }, { quantity: 2, unitPrice: 19.95 }])).toBe(124.9)
    expect(invoiceTotal([])).toBe(0)
  })
  it('ignores negative and nonsense values', () => {
    expect(lineTotal({ quantity: -2, unitPrice: 10 })).toBe(0)
    expect(lineTotal({ quantity: 2, unitPrice: -10 })).toBe(0)
    expect(lineTotal({ quantity: 1.7, unitPrice: 10 })).toBe(10)
  })
  it('explains what is wrong', () => {
    expect(invoiceProblem([])).toMatch(/at least one item/)
    expect(invoiceProblem([{ description: 'Sticker', quantity: 1, unitPrice: 0.2 }])).toMatch(/\$0\.50/)
    expect(invoiceProblem([{ description: 'Session', quantity: 0, unitPrice: 85 }])).toMatch(/quantity/)
    expect(invoiceProblem([{ description: '1-on-1 session', quantity: 1, unitPrice: 85 }, { description: '', quantity: 1, unitPrice: 0 }])).toBeNull()
  })
  it('is overdue only when sent, unpaid and past the due date', () => {
    expect(isOverdue({ status: 'sent', dueDate: '2026-11-10T00:00:00Z' }, '2026-11-15', localYmd)).toBe(true)
    expect(isOverdue({ status: 'sent', dueDate: '2026-11-20T00:00:00Z' }, '2026-11-15', localYmd)).toBe(false)
    expect(isOverdue({ status: 'paid', dueDate: '2026-11-10T00:00:00Z' }, '2026-11-15', localYmd)).toBe(false)
    expect(isOverdue({ status: 'sent', dueDate: null }, '2026-11-15', localYmd)).toBe(false)
  })
})
