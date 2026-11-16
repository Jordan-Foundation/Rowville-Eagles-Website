'use server'

import { revalidatePath } from 'next/cache'
import { payload } from '@/lib/payload'
import { currentUser } from '@/lib/auth'
import { isReferralProgram } from '@/referrals/programs'
import { claimReward, createInvite, ReferralError } from '@/referrals/service'

export type InviteState = { error?: string; link?: string; name?: string }

/** "Get link": a new link for one friend, which the parent shares themselves. */
export async function getInviteLink(_prev: InviteState, fd: FormData): Promise<InviteState> {
  const user = await currentUser()
  if (!user) return { error: 'Please log in again.' }
  const featured = String(fd.get('featured') ?? '')
  if (!isReferralProgram(featured)) return { error: 'Choose the program you’re recommending.' }
  try {
    const { link } = await createInvite(await payload(), user, {
      participantId: Number(fd.get('player')),
      name: String(fd.get('name') ?? '').slice(0, 80),
      email: String(fd.get('email') ?? '').slice(0, 200),
      phone: String(fd.get('phone') ?? '').slice(0, 30),
      featured,
    })
    revalidatePath('/account/referrals')
    return { link, name: String(fd.get('name') ?? '').trim() }
  } catch (e) {
    if (e instanceof ReferralError) return { error: e.message }
    console.error(e)
    return { error: 'Something went wrong — please try again.' }
  }
}

export type ClaimState = { error?: string; done?: string }

/** Claim a kit / bag / hoodie (with a size). */
export async function claimRewardAction(_prev: ClaimState, fd: FormData): Promise<ClaimState> {
  const user = await currentUser()
  if (!user) return { error: 'Please log in again.' }
  try {
    await claimReward(await payload(), user, Number(fd.get('grant')), String(fd.get('size') ?? '') || undefined)
    revalidatePath('/account/referrals')
    return { done: 'Claimed! We’ll let you know when it’s ready.' }
  } catch (e) {
    if (e instanceof ReferralError) return { error: e.message }
    return { error: 'Something went wrong — please try again.' }
  }
}
