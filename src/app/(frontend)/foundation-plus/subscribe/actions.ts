'use server'

import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import { payload } from '@/lib/payload'
import { birthYearOf } from '@/lib/age-groups'
import { BillingError, startSubscription } from '@/academy/pdr/billing/subscribe'
import type { PlanKey } from '@/academy/pdr/billing/plans'

export type SubscribeState = { error?: string }

export async function subscribeAction(_prev: SubscribeState, fd: FormData): Promise<SubscribeState> {
  const user = await currentUser()
  if (!user) return { error: 'Please log in again.' }
  const p = await payload()
  let url: string
  try {
    url = await startSubscription(p, user, { playerId: Number(fd.get('player')), plan: String(fd.get('plan')) as PlanKey })
  } catch (e) {
    if (e instanceof BillingError) return { error: e.message }
    p.logger.error({ err: e, msg: 'Starting a Foundation+ subscription failed' })
    return { error: 'We couldn’t start the payment. Please try again.' }
  }
  redirect(url)
}

export type AddPlayerState = { error?: string; done?: string }

/** Families without a player record yet can add one here. */
export async function addPlayerAction(_prev: AddPlayerState, fd: FormData): Promise<AddPlayerState> {
  const user = await currentUser()
  if (!user) return { error: 'Please log in again.' }
  const firstName = String(fd.get('firstName') ?? '').trim()
  const lastName = String(fd.get('lastName') ?? '').trim()
  const dateOfBirth = String(fd.get('dob') ?? '')
  const by = birthYearOf(dateOfBirth)
  if (!firstName || !lastName || !by || by < 2005 || by > new Date().getFullYear() - 3) return { error: 'Please enter the player’s name and date of birth.' }
  const p = await payload()
  const { findOrCreateParticipant } = await import('@/lib/accounts')
  await findOrCreateParticipant(p, user.id, { firstName, lastName, dateOfBirth })
  const { revalidatePath } = await import('next/cache')
  revalidatePath('/foundation-plus', 'layout')
  return { done: `${firstName} added.` }
}
