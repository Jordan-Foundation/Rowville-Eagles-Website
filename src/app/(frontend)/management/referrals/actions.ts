'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { ReferralMilestone } from '@/payload-types'
import { payload } from '@/lib/payload'
import { managementOrNull } from '@/lib/management'
import { grantMilestones, issueCredit, resolveCode } from '@/referrals/service'

const q = { overrideAccess: true, depth: 0 } as const
const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null | undefined)) ?? null

/** Confirm / void / reassign a referral — with a note for the audit trail. */
export async function referralOverride(fd: FormData) {
  const back = (k: 'done' | 'error', m: string) => redirect(`/management/referrals?${String(fd.get('qs') ?? '')}&${k}=${encodeURIComponent(m)}`)
  const user = await managementOrNull()
  if (!user) return back('error', 'Management only.')
  const p = await payload()
  const id = Number(fd.get('id'))
  const note = String(fd.get('note') ?? '').trim().slice(0, 300)
  if (!note) return back('error', 'Add a note saying why — it’s kept with the referral.')
  const r = await p.findByID({ collection: 'referrals', id, ...q, disableErrors: true })
  if (!r) return back('error', 'Referral not found.')
  const log = (action: string) => [...(r.history ?? []), { at: new Date().toISOString(), action, by: user.id, note }]
  const what = String(fd.get('do'))
  if (what === 'confirm') {
    await p.update({ collection: 'referrals', id, ...q, data: { status: 'confirmed', confirmedAt: new Date().toISOString(), reviewFlag: null, history: log('Confirmed by Management') } })
    await grantMilestones(p, rel(r.referrer)!)
  } else if (what === 'void') {
    await p.update({ collection: 'referrals', id, ...q, data: { status: 'voided', reviewFlag: null, history: log('Voided by Management') } })
  } else if (what === 'reassign') {
    const hit = await resolveCode(p, fd.get('code'))
    if (!hit) return back('error', 'That referral code doesn’t exist.')
    if (rel(hit.participant.account) === rel(r.referredAccount)) return back('error', 'A family can’t refer itself.')
    await p.update({ collection: 'referrals', id, ...q, data: { referrer: hit.participant.id, referrerAccount: rel(hit.participant.account), attribution: 'manual', history: log(`Reassigned to ${hit.code}`) } })
    if (r.status === 'confirmed') await grantMilestones(p, hit.participant.id)
  } else if (what === 'clear') {
    await p.update({ collection: 'referrals', id, ...q, data: { reviewFlag: null, history: log('Checked — keep counting') } })
  } else return back('error', 'Unknown action.')
  revalidatePath('/management/referrals')
  back('done', 'Saved.')
}

/** Rewards queue: mark handed over, or release a held reward. */
export async function rewardAction(fd: FormData) {
  const back = (k: 'done' | 'error', m: string) => redirect(`/management/referrals?tab=rewards&${k}=${encodeURIComponent(m)}`)
  const user = await managementOrNull()
  if (!user) return back('error', 'Management only.')
  const p = await payload()
  const g = await p.findByID({ collection: 'referral-rewards', id: Number(fd.get('id')), depth: 1, overrideAccess: true, disableErrors: true })
  if (!g) return back('error', 'Reward not found.')
  if (fd.get('do') === 'fulfil') {
    await p.update({ collection: 'referral-rewards', id: g.id, ...q, data: { status: 'fulfilled', fulfilledAt: new Date().toISOString() } })
    return back('done', 'Marked as handed over.')
  }
  if (fd.get('do') === 'release' && g.status === 'held') {
    const kid = await p.findByID({ collection: 'participants', id: rel(g.participant)!, ...q })
    const account = rel(kid.account) ? await p.findByID({ collection: 'users', id: rel(kid.account)!, ...q, disableErrors: true }) : null
    if (!account) return back('error', 'This player has no family account — add one first.')
    await p.update({ collection: 'referral-rewards', id: g.id, ...q, data: { status: 'unlocked', account: account.id, note: null } })
    await issueCredit(p, g.id, g.milestone as ReferralMilestone, account, kid)
    return back('done', 'Released to the family.')
  }
  back('error', 'Nothing to do.')
}
