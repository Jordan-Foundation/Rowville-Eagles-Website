'use server'

import { redirect } from 'next/navigation'
import { checkoutRegistration, slotTaken, TermClosedError } from '@/academy/terms/service'
import { spotsLeft } from '@/academy/terms/slots'
import { loadTermRegistration } from './load'

export async function payTerm(_prev: { error?: string }, fd: FormData): Promise<{ error?: string }> {
  const ref = String(fd.get('ref') ?? '')
  const token = String(fd.get('t') ?? '') || null
  const data = await loadTermRegistration(ref, token)
  if (!data) return { error: 'This link isn’t valid. Please log in or contact us.' }
  const { p, reg, program, slot } = data
  if (!slot || !['offered', 'pending_payment'].includes(reg.status)) return { error: 'This place is no longer available to pay for.' }
  if (program.status !== 'open' && program.status !== 'full') return { error: 'This program has closed.' }
  // An expired offer can still be taken while the slot has room
  const held = reg.status === 'offered' && reg.offerExpiresAt && new Date(reg.offerExpiresAt) > new Date()
  if (!held) {
    const taken = await slotTaken(p, program.id)
    const self = reg.status === 'pending_payment' ? 1 : 0
    if (spotsLeft(slot, (taken.get(slot.id) ?? 0) - self) === 0) return { error: 'Sorry, this training time is now full. Please contact us and we’ll find another option.' }
  }
  let url: string
  try {
    url = await checkoutRegistration(p, reg, program, slot, `/academy/terms/pay/${reg.reference}${token ? `?t=${token}&cancelled=1` : '?cancelled=1'}`)
  } catch (e) {
    if (e instanceof TermClosedError) return { error: `${e.message} Please contact us.` }
    p.logger.error(e)
    return { error: 'We couldn’t start the payment. Please try again, or contact us if this keeps happening.' }
  }
  redirect(url)
}
