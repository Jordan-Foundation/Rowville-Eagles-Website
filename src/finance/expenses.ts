import type { Payload } from 'payload'
import type { Expense, User } from '@/payload-types'
import { bestMatch, detectSource, isIncomeTransfer, type BankRow } from './bank'

const q = { overrideAccess: true, depth: 0 } as const
const idOf = (v: unknown): number | null => (v && typeof v === 'object' ? ((v as { id?: number }).id ?? null) : typeof v === 'number' ? v : null)

export const DEFAULT_CATEGORIES = ['Equipment', 'Kit & uniforms', 'Venue hire', 'Software & subscriptions', 'Marketing', 'Fuel & travel', 'Food & events', 'Other']

export async function categories(p: Payload) {
  let { docs } = await p.find({ collection: 'expense-categories', sort: 'sortOrder', limit: 100, pagination: false, ...q })
  if (!docs.length) {
    for (const [i, name] of DEFAULT_CATEGORIES.entries()) await p.create({ collection: 'expense-categories', data: { name, active: true, sortOrder: i }, ...q }).catch(() => null)
    docs = (await p.find({ collection: 'expense-categories', sort: 'sortOrder', limit: 100, pagination: false, ...q })).docs
  }
  return docs
}

export const categoryIdFor = async (p: Payload, name?: string | null) => {
  const list = await categories(p)
  const n = (name ?? '').toLowerCase()
  return (list.find((c) => c.name.toLowerCase() === n) ?? list.find((c) => n && c.name.toLowerCase().includes(n.split(' ')[0])) ?? list.find((c) => c.name === 'Other'))?.id ?? null
}

/** Same supplier + date + amount already recorded (e.g. the same receipt arriving twice). */
export async function duplicateOf(p: Payload, e: { supplier: string; date: string; amount: number; sourceRef?: string | null }) {
  if (e.sourceRef) {
    const { docs } = await p.find({ collection: 'expenses', where: { sourceRef: { equals: e.sourceRef } }, limit: 1, ...q })
    if (docs[0]) return docs[0]
  }
  const { docs } = await p.find({ collection: 'expenses', where: { and: [{ date: { equals: e.date } }, { amount: { greater_than: e.amount - 0.005 } }, { amount: { less_than: e.amount + 0.005 } }] }, limit: 20, ...q })
  const sup = e.supplier.trim().toLowerCase()
  return docs.find((d) => d.supplier.trim().toLowerCase() === sup) ?? null
}

export type NewExpense = { date: string; supplier: string; amount: number; gst?: number | null; description?: string | null; category?: number | null; paymentMethod?: Expense['paymentMethod']; source: Expense['source']; status?: Expense['status']; receipt?: number | null; sourceRef?: string | null; recurring?: boolean; notes?: string | null; bankTransaction?: number | null }

/** Saves an expense (skipping duplicates) and tries to link it to a bank debit. */
export async function createExpense(p: Payload, e: NewExpense, user?: User | null) {
  const dup = await duplicateOf(p, e)
  if (dup) return { expense: dup, duplicate: true }
  const expense = await p.create({ collection: 'expenses', data: { ...e, status: e.status ?? 'needs_review' }, ...q, user: user ?? undefined })
  if (e.bankTransaction) await p.update({ collection: 'bank-transactions', id: e.bankTransaction, data: { status: 'matched', matchedExpense: expense.id }, ...q, user: user ?? undefined })
  else await matchBank(p)
  return { expense, duplicate: false }
}

/** Imports a statement file. New rows only (by the bank's own ID), then auto-matches debits to expenses. */
export async function importStatement(p: Payload, filename: string, text: string, user?: User | null) {
  const source = detectSource(filename, text)
  const rows: BankRow[] = source.parse(text)
  let added = 0
  let skipped = 0
  for (const r of rows) {
    const { totalDocs } = await p.count({ collection: 'bank-transactions', where: { externalId: { equals: r.externalId } }, overrideAccess: true })
    if (totalDocs) { skipped++; continue }
    await p.create({ collection: 'bank-transactions', data: { source: source.name, account: r.account ?? null, date: r.date, description: r.description, amount: r.amount, direction: r.direction, externalId: r.externalId, status: isIncomeTransfer(r) ? 'income_transfer' : 'unmatched' }, ...q, user: user ?? undefined })
    added++
  }
  const matched = await matchBank(p)
  return { rows: rows.length, added, skipped, matched }
}

/** Links unmatched bank debits to expenses with the same amount within a few days (supplier name helps). */
export async function matchBank(p: Payload) {
  const [{ docs: debits }, { docs: expenses }] = await Promise.all([
    p.find({ collection: 'bank-transactions', where: { and: [{ status: { equals: 'unmatched' } }, { direction: { equals: 'debit' } }] }, limit: 5000, pagination: false, ...q }),
    p.find({ collection: 'expenses', where: { bankTransaction: { exists: false } }, limit: 10000, pagination: false, ...q }),
  ])
  const pool = expenses.map((e) => ({ id: e.id, date: e.date, amount: e.amount, supplier: e.supplier, linked: Boolean(idOf(e.bankTransaction)) }))
  let n = 0
  for (const d of debits) {
    const m = bestMatch({ date: d.date, amount: d.amount, description: d.description ?? '', direction: 'debit' }, pool)
    if (!m) continue
    m.linked = true
    await p.update({ collection: 'bank-transactions', id: d.id, data: { status: 'matched', matchedExpense: m.id }, ...q })
    await p.update({ collection: 'expenses', id: m.id, data: { bankTransaction: d.id }, ...q })
    n++
  }
  return n
}

/** Store a receipt file (photo or PDF) privately. */
export async function saveReceiptFile(p: Payload, file: { data: Buffer; mimetype: string; name: string; size: number }, user?: User | null) {
  const doc = await p.create({ collection: 'receipt-files', data: {}, file, ...q, user: user ?? undefined })
  return doc.id
}
