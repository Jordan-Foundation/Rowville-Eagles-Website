/** Invoice maths (pure — unit tested). Amounts are AUD, rounded to the cent. */
export type InvoiceLine = { description?: string | null; quantity?: number | null; unitPrice?: number | null }

const cents = (n: number) => Math.round(n * 100)

export const lineTotal = (l: InvoiceLine) => cents(Math.max(0, Number(l.unitPrice) || 0)) * Math.max(0, Math.floor(Number(l.quantity) || 0)) / 100

export const invoiceTotal = (lines: InvoiceLine[] | null | undefined) => (lines ?? []).reduce((t, l) => t + cents(lineTotal(l)), 0) / 100

/** Why these lines can't make an invoice a family can pay by card (null when fine). */
export function invoiceProblem(lines: InvoiceLine[]): string | null {
  const real = lines.filter((l) => (l.description ?? '').trim())
  if (!real.length) return 'Add at least one item.'
  if (real.some((l) => !(Number(l.quantity) >= 1) || !Number.isFinite(Number(l.unitPrice)) || Number(l.unitPrice) < 0)) return 'Each item needs a quantity of 1 or more and a price of $0 or more.'
  const total = invoiceTotal(real)
  if (total < 0.5) return 'The total must be at least $0.50 — card payments can’t be smaller.'
  return null
}

/** Overdue: sent, unpaid, and the due date (Melbourne) has passed. `todayYmd` is today's local date. */
export const isOverdue = (inv: { status?: string | null; dueDate?: string | null }, todayYmd: string, localYmd: (d: Date) => string) =>
  inv.status === 'sent' && !!inv.dueDate && localYmd(new Date(inv.dueDate)) < todayYmd

export const INVOICE_STATUS: Record<string, string> = { draft: 'Draft — not sent', sent: 'Waiting for payment', paid: 'Paid', cancelled: 'Cancelled', refunded: 'Refunded' }
