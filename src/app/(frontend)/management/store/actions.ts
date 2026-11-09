'use server'

import { revalidatePath } from 'next/cache'
import { managementOrNull } from '@/lib/management'
import { payload } from '@/lib/payload'
import { sendEmail } from '@/lib/email'
import { emailLayout, esc } from '@/lib/email-templates'

const NEXT: Record<string, string[]> = { paid: ['ready', 'completed'], ready: ['completed'] }

/** Move an order along: paid → ready (family emailed) → completed. */
export async function setOrderStatus(fd: FormData) {
  const user = await managementOrNull()
  if (!user) return
  const p = await payload()
  const order = await p.findByID({ collection: 'orders', id: Number(fd.get('id')), depth: 0, overrideAccess: true, disableErrors: true })
  const to = String(fd.get('to'))
  if (!order || !NEXT[order.status]?.includes(to)) return
  await p.update({ collection: 'orders', id: order.id, data: { status: to as 'ready' | 'completed' }, overrideAccess: true })
  if (to === 'ready') {
    const post = order.fulfilment === 'post'
    await sendEmail(p, {
      to: order.contact.email,
      subject: post ? `Your order ${order.reference} is on its way` : `Your order ${order.reference} is ready to collect`,
      html: emailLayout('club', [{ heading: post ? 'Your order is on its way' : 'Ready to collect', intro: `Hi ${esc(order.contact.name.split(' ')[0])}, ${post ? 'we’ve posted your order.' : 'your order is ready — collect it from the clubrooms on a training night.'}`, rows: (order.items ?? []).map((i) => [`${i.quantity ?? 1} ×`, `${i.name ?? ''}${i.size ? ` (${i.size})` : ''}`] as [string, string]) }]),
      sender: 'club',
    })
  }
  revalidatePath('/management/store')
}
