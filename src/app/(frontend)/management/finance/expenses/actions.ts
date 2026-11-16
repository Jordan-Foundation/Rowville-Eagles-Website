'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { financeOrNull } from '@/finance/access'
import { readReceipt, receiptAiConfigured, type ReceiptData } from '@/finance/ai'
import { categories, categoryIdFor, createExpense, importStatement, matchBank, saveReceiptFile } from '@/finance/expenses'

const q = { overrideAccess: true, depth: 0 } as const
const YMD = /^\d{4}-\d{2}-\d{2}$/
const back = (tab: string, k: 'done' | 'error', m: string, extra = '') => redirect(`/management/finance/expenses?tab=${tab}${extra}&${k}=${encodeURIComponent(m)}`)

export type ReadState = { error?: string; receiptId?: number; fields?: Partial<ReceiptData> & { categoryId?: number | null }; notReceipt?: boolean }

/** "Add receipt": store the photo/PDF privately, read it with Claude, and hand back a pre-filled form. */
export async function readReceiptAction(_prev: ReadState, fd: FormData): Promise<ReadState> {
  const user = await financeOrNull()
  if (!user) return { error: 'Admins only.' }
  const file = fd.get('file')
  if (!(file instanceof File) || !file.size) return { error: 'Choose a photo or PDF of the receipt.' }
  if (!/^image\/|^application\/pdf$/.test(file.type)) return { error: 'Use a photo (JPG/PNG) or a PDF.' }
  const p = await payload()
  const data = Buffer.from(await file.arrayBuffer())
  let receiptId: number
  try {
    receiptId = await saveReceiptFile(p, { data, mimetype: file.type, name: file.name || `receipt-${Date.now()}.jpg`, size: data.length }, user)
  } catch {
    return { error: 'That file couldn’t be opened as a photo or PDF — try taking the photo again.' }
  }
  if (!receiptAiConfigured()) return { receiptId, fields: {}, error: 'Receipt reading needs ANTHROPIC_API_KEY — fill the details in by hand.' }
  try {
    const cats = (await categories(p)).filter((c) => c.active !== false).map((c) => c.name)
    const r = await readReceipt({ file: { data, mediaType: file.type }, categories: cats })
    return { receiptId, notReceipt: !r.isReceipt, fields: { ...r, categoryId: await categoryIdFor(p, r.category) } }
  } catch (e) {
    return { receiptId, fields: {}, error: e instanceof Error ? e.message : 'Couldn’t read the receipt — please fill it in.' }
  }
}

export async function saveExpenseAction(fd: FormData) {
  const user = await financeOrNull()
  if (!user) return back('list', 'error', 'Admins only.')
  const s = (k: string) => String(fd.get(k) ?? '').trim()
  const date = s('date')
  const amount = Number(s('amount'))
  const gst = s('gst') === '' ? null : Number(s('gst'))
  if (!YMD.test(date) || !s('supplier') || !(amount > 0)) return back('add', 'error', 'Enter the date, supplier and amount.')
  if (gst != null && (!(gst >= 0) || gst > amount)) return back('add', 'error', 'GST looks wrong (it can’t be more than the amount).')
  const p = await payload()
  const r = await createExpense(p, {
    date, supplier: s('supplier').slice(0, 120), amount: Math.round(amount * 100) / 100, gst: gst == null ? null : Math.round(gst * 100) / 100,
    description: s('description').slice(0, 300) || null, category: Number(s('category')) || null,
    paymentMethod: (s('paymentMethod') || null) as never, source: (['photo', 'manual', 'bank'].includes(s('source')) ? s('source') : 'manual') as 'manual',
    status: 'approved', receipt: Number(s('receiptId')) || null, recurring: fd.get('recurring') === 'on', notes: s('notes').slice(0, 1000) || null,
    bankTransaction: Number(s('bankTransaction')) || null,
  }, user)
  revalidatePath('/management/finance', 'layout')
  return back('list', r.duplicate ? 'error' : 'done', r.duplicate ? `Already recorded: ${r.expense.supplier} ${r.expense.date} $${r.expense.amount.toFixed(2)}.` : 'Expense saved.')
}

export async function updateExpenseAction(fd: FormData) {
  const user = await financeOrNull()
  if (!user) return back('list', 'error', 'Admins only.')
  const p = await payload()
  const id = Number(fd.get('id'))
  const what = String(fd.get('do'))
  if (what === 'delete') {
    const e = await p.findByID({ collection: 'expenses', id, ...q })
    if (e.bankTransaction) await p.update({ collection: 'bank-transactions', id: typeof e.bankTransaction === 'object' ? e.bankTransaction.id : e.bankTransaction, data: { status: 'unmatched', matchedExpense: null }, ...q, user })
    await p.delete({ collection: 'expenses', id, ...q, user })
  } else {
    const data: Record<string, unknown> = { status: 'approved' }
    const cat = Number(fd.get('category'))
    if (cat) data.category = cat
    if (fd.has('recurring')) data.recurring = fd.get('recurring') === 'on'
    await p.update({ collection: 'expenses', id, data, ...q, user })
  }
  revalidatePath('/management/finance', 'layout')
  return back(String(fd.get('tab') ?? 'list'), 'done', what === 'delete' ? 'Expense deleted.' : 'Expense approved.')
}

/** Westpac statement upload (CSV or OFX). */
export async function importStatementAction(fd: FormData) {
  const user = await financeOrNull()
  if (!user) return back('bank', 'error', 'Admins only.')
  const file = fd.get('file')
  if (!(file instanceof File) || !file.size) return back('bank', 'error', 'Choose the CSV or OFX file you downloaded from Westpac.')
  let r: Awaited<ReturnType<typeof importStatement>>
  try {
    r = await importStatement(await payload(), file.name, await file.text(), user)
  } catch (e) {
    return back('bank', 'error', e instanceof Error ? e.message : 'Couldn’t read that file.')
  }
  revalidatePath('/management/finance', 'layout')
  return back('missing', 'done', `${r.added} new transaction${r.added === 1 ? '' : 's'} imported (${r.skipped} already here); ${r.matched} matched to expenses.`)
}

/** Missing receipts: not an expense (transfer, coach pay, refund…) / Stripe payout / link to an existing expense. */
export async function resolveBankAction(fd: FormData) {
  const user = await financeOrNull()
  if (!user) return back('missing', 'error', 'Admins only.')
  const p = await payload()
  const id = Number(fd.get('id'))
  const what = String(fd.get('do'))
  const note = String(fd.get('note') ?? '').trim().slice(0, 200) || null
  if (what === 'ignore') await p.update({ collection: 'bank-transactions', id, data: { status: 'ignored', note }, ...q, user })
  else if (what === 'income') await p.update({ collection: 'bank-transactions', id, data: { status: 'income_transfer', note }, ...q, user })
  else if (what === 'link') {
    const exp = Number(fd.get('expense'))
    if (!exp) return back('missing', 'error', 'Choose the expense to link.')
    await p.update({ collection: 'bank-transactions', id, data: { status: 'matched', matchedExpense: exp }, ...q, user })
    await p.update({ collection: 'expenses', id: exp, data: { bankTransaction: id }, ...q, user })
  } else if (what === 'unmatch') await p.update({ collection: 'bank-transactions', id, data: { status: 'unmatched', note: null }, ...q, user })
  revalidatePath('/management/finance', 'layout')
  return back('missing', 'done', 'Updated.')
}

export async function rematchAction() {
  const user = await financeOrNull()
  if (!user) return back('missing', 'error', 'Admins only.')
  const n = await matchBank(await payload())
  return back('missing', 'done', `${n} matched.`)
}
