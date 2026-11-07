'use server'

import { revalidatePath } from 'next/cache'
import { currentUser } from '@/lib/auth'
import { hasRole } from '@/access'
import { payload } from '@/lib/payload'
import { offerSlot } from '@/academy/terms/service'

export type TermStaffState = { error?: string; done?: string }

async function staff() {
  const user = await currentUser()
  return user && hasRole(user, 'admin', 'committee') ? user : null
}

export async function offerPlace(_prev: TermStaffState, fd: FormData): Promise<TermStaffState> {
  const user = await staff()
  if (!user) return { error: 'Only admins can offer places.' }
  const reg = Number(fd.get('reg'))
  const slot = Number(fd.get('slot'))
  const days = Math.min(30, Math.max(1, Number(fd.get('days') || 7)))
  if (!reg || !slot) return { error: 'Choose a training time.' }
  try {
    const r = await offerSlot(await payload(), reg, slot, { actorId: user.id, holdDays: days })
    revalidatePath('/staff/academy/terms')
    return { done: `Offer sent to ${r.contact.email}.` }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not send the offer.' }
  }
}

export async function cancelRegistration(_prev: TermStaffState, fd: FormData): Promise<TermStaffState> {
  const user = await staff()
  if (!user) return { error: 'Only admins can cancel.' }
  const p = await payload()
  const reg = await p.findByID({ collection: 'academy-registrations', id: Number(fd.get('reg')), depth: 0, overrideAccess: true, disableErrors: true })
  if (!reg) return { error: 'Not found.' }
  if (reg.status === 'paid') return { error: 'This place is paid — cancel and refund it from the booking in the admin.' }
  await p.update({ collection: 'academy-registrations', id: reg.id, overrideAccess: true, data: { status: 'cancelled', notes: [reg.notes, `Cancelled by ${user.email} on ${new Date().toISOString().slice(0, 10)}`].filter(Boolean).join('\n') } })
  revalidatePath('/staff/academy/terms')
  return { done: 'Cancelled.' }
}
