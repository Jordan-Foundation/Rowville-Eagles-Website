'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { managementOrNull } from '@/lib/management'
import { formatAUD } from '@/lib/format'
import { RefundError, refundTransaction, type Kind } from '@/refunds/service'

const KINDS: Kind[] = ['booking', 'academy', 'order', 'invoice']

/** Refund one payment to the card it came from (admins only). */
export async function refundAction(fd: FormData) {
  const q = String(fd.get('q') ?? '').slice(0, 100)
  const back = (key: 'done' | 'error', msg: string) => redirect(`/management/refunds?q=${encodeURIComponent(q)}&${key}=${encodeURIComponent(msg)}`)
  const user = await managementOrNull()
  if (!user?.roles?.includes('admin')) return back('error', 'Only admins can make refunds.')
  const kind = String(fd.get('kind')) as Kind
  if (!KINDS.includes(kind)) return back('error', 'Unknown payment.')
  const p = await payload()
  let msg: string
  try {
    const r = await refundTransaction(p, {
      kind,
      id: Number(fd.get('id')),
      amount: Number(String(fd.get('amount') ?? '').replace(/[$,\s]/g, '')),
      reason: String(fd.get('reason') ?? '').slice(0, 1000),
      cancel: fd.get('cancel') === 'on',
      emailFamily: fd.get('emailFamily') === 'on',
      actorId: user.id,
      nonce: String(fd.get('nonce') ?? ''),
    })
    msg = `Refunded ${formatAUD(r.amount)} to the card for ${r.reference}${r.cancelled ? ' and cancelled the booking' : ''}${r.status === 'simulated' ? ' (test mode — no real money moved)' : ''}.`
  } catch (e) {
    if (!(e instanceof RefundError)) p.logger.error(e)
    return back('error', e instanceof Error ? e.message : 'The refund didn’t go through.')
  }
  revalidatePath('/management/refunds')
  back('done', msg)
}
