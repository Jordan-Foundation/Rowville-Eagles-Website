import type { Payload } from 'payload'
import type { Participant, User } from '@/payload-types'
import { esc, emailLayout } from '../../lib/email-templates'
import { sendEmail } from '../../lib/email'
import { sendSms } from '../../lib/sms'
import { siteUrl } from '../../lib/payments'
import { formatDate } from '../../lib/format'
import { PLANS } from './billing/plans'
import { canRemind, challengeSetupNeeded, graceDaysLeft } from './manage-rules'

const q = { overrideAccess: true, depth: 0 } as const
const PAST_DUE = ['past_due', 'unpaid']

export type PastDueRow = { kid: Participant; parent: User | null; plan: string; since: string | null; daysLeft: number; remindedAt: string | null; canRemind: boolean }

/** Players whose Foundation+ payment is failing and who still have access (in the grace period). */
export async function pastDueMembers(p: Payload, now = new Date()): Promise<PastDueRow[]> {
  const { docs } = await p.find({ pagination: false, collection: 'participants', where: { 'pdr.subscriptionStatus': { in: PAST_DUE }, 'pdr.tier': { not_equals: 'free' } }, sort: 'pdr.pastDueSince', limit: 300, overrideAccess: true, depth: 1 })
  return docs.map((kid) => {
    const parent = kid.account && typeof kid.account === 'object' ? kid.account : null
    const plan = PLANS.find((x) => x.key === kid.pdr?.plan)
    return {
      kid,
      parent,
      plan: plan ? `${plan.tier === 'premium' ? 'Premium' : 'Standard'} · ${plan.interval === 'year' ? 'yearly' : 'monthly'}` : (kid.pdr?.tier ?? ''),
      since: kid.pdr?.pastDueSince ?? null,
      daysLeft: graceDaysLeft(kid.pdr?.pastDueSince, now),
      remindedAt: kid.pdr?.pastDueReminderAt ?? null,
      canRemind: canRemind(kid.pdr?.pastDueReminderAt, now),
    }
  })
}

/** Email + text the parent asking them to update their card (at most once a day per player). */
export async function sendPastDueReminder(p: Payload, kidId: number, now = new Date()) {
  const kid = await p.findByID({ collection: 'participants', id: kidId, overrideAccess: true, depth: 1 })
  if (!PAST_DUE.includes(kid.pdr?.subscriptionStatus ?? '')) throw new Error(`${kid.firstName}’s payments are up to date now.`)
  if (!canRemind(kid.pdr?.pastDueReminderAt, now)) throw new Error('A reminder was already sent today.')
  const parent = kid.account && typeof kid.account === 'object' ? kid.account : null
  if (!parent?.email) throw new Error('No parent account to contact.')
  const left = graceDaysLeft(kid.pdr?.pastDueSince, now)
  const href = `${siteUrl()}/foundation-plus/billing?player=${kid.id}`
  const when = left <= 0 ? 'today' : left === 1 ? 'tomorrow' : `in ${left} days`
  await p.update({ collection: 'participants', id: kid.id, overrideAccess: true, data: { pdr: { ...kid.pdr, pastDueReminderAt: now.toISOString() } } })
  await sendEmail(p, {
    to: parent.email,
    subject: `Foundation+: please update ${kid.firstName}’s payment details`,
    sender: 'academy',
    userId: parent.id,
    html: emailLayout('academy', [{
      heading: 'Your payment didn’t go through',
      intro: `Hi ${esc(parent.firstName || 'there')} — we still haven’t been able to take the payment for ${esc(kid.firstName)}’s Foundation+ plan. Please update your card so ${esc(kid.firstName)} keeps their plan — otherwise it moves to Free ${when}. Their progress is always kept.`,
      rows: kid.pdr?.pastDueSince ? [['Payment failing since', formatDate(kid.pdr.pastDueSince, { day: 'numeric', month: 'long' })]] : undefined,
      cta: { label: 'Update payment details', href },
      after: 'Already sorted it? Thanks — you can ignore this email.',
    }]),
  })
  await sendSms(p, { to: parent.phone, kind: 'service', optedOut: parent.smsOptOut, userId: parent.id, body: `Foundation+: we couldn’t take ${kid.firstName}’s payment. Please update your card to keep their plan: ${href} – Foundation Academy` })
  return { kid: kid.firstName, parent: parent.email }
}

/** Dashboard badge: videos waiting + past-due players + next month's challenge not ready. */
export async function foundationAttention(p: Payload, now = new Date()) {
  const [reviews, pastDue, challenges] = await Promise.all([
    p.count({ collection: 'pdr-submissions', where: { status: { equals: 'pending' } }, overrideAccess: true }),
    p.count({ collection: 'participants', where: { 'pdr.subscriptionStatus': { in: PAST_DUE }, 'pdr.tier': { not_equals: 'free' } }, overrideAccess: true }),
    p.find({ pagination: false, collection: 'pdr-challenges', sort: '-month', limit: 3, ...q, select: { month: true, published: true } }),
  ])
  return reviews.totalDocs + pastDue.totalDocs + (challengeSetupNeeded(challenges.docs, now) ? 1 : 0)
}
