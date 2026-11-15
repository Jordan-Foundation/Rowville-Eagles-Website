'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { managementOrNull } from '@/lib/management'
import { localToUtc } from '@/lib/time'
import { cancelInvoice, InvoiceError, markInvoicePaid, markInvoiceRefunded, saveInvoice, sendInvoice } from '@/invoices/service'

export type InvoiceFormState = { error?: string }

const str = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? '').trim().slice(0, max)
const sentMsg = (r: { email: boolean; sms: boolean }) => `Sent by ${[r.email && 'email', r.sms && 'text'].filter(Boolean).join(' and ')}.`

/** Create or edit an invoice, then (optionally) send it. */
export async function saveInvoiceAction(_prev: InvoiceFormState, fd: FormData): Promise<InvoiceFormState> {
  const user = await managementOrNull()
  if (!user) return { error: 'Management only.' }
  const p = await payload()
  const desc = fd.getAll('desc').map(String)
  const qty = fd.getAll('qty').map(String)
  const price = fd.getAll('price').map(String)
  const src = fd.getAll('src').map(String)
  const due = str(fd, 'dueDate', 10)
  const id = Number(fd.get('id')) || undefined
  const send = fd.get('do') === 'send'
  const email = fd.get('byEmail') === 'on'
  const sms = fd.get('bySms') === 'on'
  if (send && !email && !sms) return { error: 'Choose email, text or both to send the invoice.' }
  let invoiceId: number
  let msg = 'Saved.'
  try {
    const inv = await saveInvoice(p, {
      payee: fd.get('payee') === 'club' ? 'club' : 'academy',
      account: Number(fd.get('account')) || null,
      contactName: str(fd, 'contactName', 120),
      contactEmail: str(fd, 'contactEmail', 200) || null,
      contactPhone: str(fd, 'contactPhone', 30) || null,
      playerName: str(fd, 'playerName', 120) || null,
      items: desc.map((d, i) => ({ description: d, quantity: Number(qty[i]), unitPrice: Number(price[i]), source: src[i] || null })),
      note: str(fd, 'note', 2000) || null,
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(due) ? localToUtc(due, '12:00').toISOString() : null,
    }, { id, by: user.id })
    invoiceId = inv.id
  } catch (e) {
    if (e instanceof InvoiceError) return { error: e.message }
    p.logger.error(e)
    return { error: 'Something went wrong — please try again.' }
  }
  if (send) {
    try {
      msg = sentMsg(await sendInvoice(p, invoiceId, { email, sms }))
    } catch (e) {
      // Saved, but not sent: show it on the invoice page (so a retry doesn't create a second invoice)
      if (!(e instanceof InvoiceError)) p.logger.error(e)
      redirect(`/management/invoices/${invoiceId}?error=${encodeURIComponent(`Saved, but not sent: ${e instanceof InvoiceError ? e.message : 'something went wrong.'}`)}`)
    }
  }
  revalidatePath('/management/invoices')
  redirect(`/management/invoices/${invoiceId}?done=${encodeURIComponent(msg)}`)
}

/** Detail page buttons: send / remind / mark paid / cancel / refunded. */
export async function invoiceAction(fd: FormData) {
  const id = Number(fd.get('id'))
  const back = (msg: string, key: 'done' | 'error' = 'done') => redirect(`/management/invoices/${id}?${key}=${encodeURIComponent(msg)}`)
  const user = await managementOrNull()
  if (!user) return back('Management only.', 'error')
  const p = await payload()
  let msg: string
  try {
    switch (String(fd.get('do'))) {
      case 'send':
      case 'remind': {
        const email = fd.get('byEmail') === 'on'
        const sms = fd.get('bySms') === 'on'
        if (!email && !sms) return back('Choose email, text or both.', 'error')
        msg = sentMsg(await sendInvoice(p, id, { email, sms, reminder: fd.get('do') === 'remind' }))
        break
      }
      case 'paid': {
        const inv = await p.findByID({ collection: 'invoices', id, depth: 0, overrideAccess: true })
        await markInvoicePaid(p, inv.reference, { via: 'manual', note: str(fd, 'paymentNote') || `Marked paid by ${user.firstName ?? 'Management'}` })
        msg = 'Marked as paid. A receipt was emailed to the family.'
        break
      }
      case 'cancel':
        await cancelInvoice(p, id)
        msg = 'Invoice cancelled — the pay link no longer works.'
        break
      case 'refunded':
        await markInvoiceRefunded(p, id)
        msg = 'Marked as refunded. (Make sure the refund is done in Stripe.)'
        break
      default:
        return back('Unknown action.', 'error')
    }
  } catch (e) {
    if (e instanceof InvoiceError) return back(e.message, 'error')
    p.logger.error(e)
    return back('Something went wrong — please try again.', 'error')
  }
  revalidatePath('/management/invoices')
  back(msg)
}
