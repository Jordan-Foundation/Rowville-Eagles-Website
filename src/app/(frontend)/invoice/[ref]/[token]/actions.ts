'use server'

import { redirect } from 'next/navigation'
import { payload } from '@/lib/payload'
import { checkoutFailMessage } from '@/lib/payments'
import { InvoiceError, startInvoicePayment } from '@/invoices/service'

export type PayInvoiceState = { error?: string }

/** Pay button: start (or carry on) the Stripe checkout for this invoice. */
export async function payInvoice(_prev: PayInvoiceState, fd: FormData): Promise<PayInvoiceState> {
  const ref = String(fd.get('ref') ?? '').slice(0, 40)
  const token = String(fd.get('token') ?? '').slice(0, 80)
  const p = await payload()
  let url: string
  try {
    url = await startInvoicePayment(p, ref, token)
  } catch (e) {
    if (e instanceof InvoiceError) return { error: e.message }
    p.logger.error(e)
    return { error: checkoutFailMessage(e, 'We couldn’t start the payment. Please try again shortly, or contact us.') }
  }
  redirect(url)
}
