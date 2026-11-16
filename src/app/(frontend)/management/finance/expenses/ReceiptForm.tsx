'use client'

import { useActionState, useState } from 'react'
import { readReceiptAction, saveExpenseAction, type ReadState } from './actions'

const input = 'min-h-10 w-full border border-line bg-surface px-2 text-sm'

/** Photos are shrunk on the phone (max 2000px JPEG) so they upload quickly and fit the 3 MB limit. */
async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size < 900_000) return file
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.82))
  return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file
}

export function ReceiptForm({ categories, today, bank }: { categories: { id: number; name: string }[]; today: string; bank?: { id: number; date: string; amount: number; description: string } }) {
  const [state, read, reading] = useActionState<ReadState, FormData>(readReceiptAction, {})
  const [busy, setBusy] = useState(false)
  const f = state.fields ?? {}
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    const fd = new FormData()
    fd.set('file', await shrink(file))
    setBusy(false)
    read(fd)
  }
  const key = `${state.receiptId ?? 'none'}-${f.supplier ?? ''}`
  return (
    <div className="space-y-5">
      <div className="panel border border-line p-4">
        <label className="block text-sm font-semibold">📷 Add receipt — take a photo or choose a file
          <input type="file" accept="image/*,application/pdf" capture="environment" onChange={onFile} className="mt-2 block text-sm" data-receipt-file />
        </label>
        <p className="mt-1 text-xs text-muted">{busy ? 'Preparing photo…' : reading ? 'Reading the receipt…' : 'The details are read automatically — check them, then save.'}</p>
        {state.receiptId && !reading && <p role="status" className="mt-2 text-sm">Receipt attached{state.fields?.supplier ? ' and read' : ''}.</p>}
        {state.notReceipt && <p role="alert" className="mt-2 text-sm text-amber-300">This doesn’t look like a receipt or invoice — check it before saving.</p>}
        {state.error && <p role="alert" className="mt-2 text-sm text-red-400">{state.error}</p>}
      </div>
      <form key={key} action={saveExpenseAction} className="grid gap-3 text-sm sm:grid-cols-2" aria-label="Expense details">
        <input type="hidden" name="receiptId" value={state.receiptId ?? ''} />
        <input type="hidden" name="source" value={bank ? 'bank' : state.receiptId ? 'photo' : 'manual'} />
        {bank && <input type="hidden" name="bankTransaction" value={bank.id} />}
        <label className="grid gap-1">Date<input type="date" name="date" required defaultValue={f.date || bank?.date || today} className={input} /></label>
        <label className="grid gap-1">Supplier<input name="supplier" required defaultValue={f.supplier ?? ''} className={input} placeholder="e.g. Rebel Sport" /></label>
        <label className="grid gap-1">Amount incl. GST ($)<input type="number" name="amount" step="0.01" min="0.01" required defaultValue={f.total || bank?.amount || ''} className={input} /></label>
        <label className="grid gap-1">GST ($)<input type="number" name="gst" step="0.01" min="0" defaultValue={f.gst ?? ''} className={input} /></label>
        <label className="grid gap-1 sm:col-span-2">What was it for<input name="description" defaultValue={f.summary ?? bank?.description ?? ''} className={input} /></label>
        <label className="grid gap-1">Category
          <select name="category" defaultValue={f.categoryId ?? ''} className={input}><option value="">Choose…</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
        <label className="grid gap-1">Paid by
          <select name="paymentMethod" defaultValue={f.paymentMethod ?? 'card'} className={input}>{['card', 'bank transfer', 'direct debit', 'cash', 'other'].map((m) => <option key={m}>{m}</option>)}</select>
        </label>
        <label className="flex items-center gap-2"><input type="checkbox" name="recurring" /> Recurring every month</label>
        <label className="grid gap-1 sm:col-span-2">Notes<input name="notes" className={input} /></label>
        <button disabled={reading || busy} className="min-h-10 border border-white bg-white px-4 font-semibold text-black disabled:opacity-50 sm:col-span-2">Save expense</button>
      </form>
    </div>
  )
}
