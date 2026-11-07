import { createHash } from 'crypto'
import type { Payload } from 'payload'
import type { Participant, User } from '@/payload-types'
import { ensureAccount } from '../../../lib/accounts'
import { sendEmail } from '../../../lib/email'
import { emailLayout, esc } from '../../../lib/email-templates'
import { formatAUD, formatDate } from '../../../lib/format'
import { createInvite } from '../../../lib/invites'
import { siteUrl } from '../../../lib/payments'
import { stripeFor } from '../../../lib/stripe-accounts'
import { foundationSettings } from '../load'
import { logEvent } from './sync'
import { displayPrices } from './stripe'

/**
 * Foundation+ free month of Premium. One per family (account/email), per player and per card.
 * Links are emailed (the address must be real); the card is collected up front by Stripe Checkout.
 */
const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number))
const LIVE = new Set(['active', 'trialing', 'past_due'])
export type LinkMode = 'trial' | 'join'

export function trialEligibility(family: Participant[], kid: Participant | null): { ok: true } | { ok: false; reason: string } {
  if (family.some((k) => k.pdr?.trialUsedAt)) return { ok: false, reason: 'Your family has already had its free month — you can still choose a plan.' }
  if (kid && LIVE.has(kid.pdr?.subscriptionStatus ?? '')) return { ok: false, reason: `${kid.firstName} already has a plan.` }
  return { ok: true }
}

async function family(payload: Payload, userId: number) {
  return (await payload.find({ collection: 'participants', where: { account: { equals: userId } }, limit: 20, depth: 0, overrideAccess: true })).docs as Participant[]
}

/** Email a secure link: start a free month (trial) or create a free account (join). Never reveals anything on screen. */
export async function emailLink(payload: Payload, email: string, mode: LinkMode, o: { ttlDays?: number; launch?: boolean } = {}) {
  const { name } = await foundationSettings(payload)
  const { user } = await ensureAccount(payload, { email })
  const usedTrial = mode === 'trial' && !trialEligibility(await family(payload, user.id), null).ok
  if (usedTrial) {
    const html = emailLayout('academy', [
      {
        heading: `Your ${name} link`,
        intro: `Your family has already had its free month of ${esc(name)} Premium, so we can’t start another — but you can choose a plan any time.`,
        cta: { label: 'See plans', href: `${siteUrl()}/foundation-plus#pricing` },
        after: 'Didn’t ask for this? You can ignore this email.',
      },
    ])
    await sendEmail(payload, { to: email, subject: `Your ${name} link`, html, sender: 'academy', userId: user.id })
    return 'already_used' as const
  }
  const token = await createInvite(payload, { userId: user.id, email, purpose: mode === 'trial' ? 'fplus-trial' : 'fplus-join', ttlDays: o.ttlDays ?? 2 })
  const href = `${siteUrl()}/foundation-plus/start?token=${encodeURIComponent(token)}`
  const prices = await displayPrices(payload)
  const html =
    mode === 'trial'
      ? emailLayout('academy', [
          {
            heading: o.launch ? `${name} is live!` : 'Claim your free month',
            intro: `${o.launch ? `Thanks for joining the waitlist — ${esc(name)} is now open. ` : ''}Use the button below to ${user.activated ? 'log in' : 'create your player portal account'} and start a <strong>free month of ${esc(name)} Premium</strong>. A card is needed to start; we’ll email you 7 days before the month ends, and if you don’t cancel it continues at ${esc(formatAUD(prices.premium_month))}/month.`,
            cta: { label: 'Start my free month', href },
            after: `This link is just for you and works for ${o.ttlDays ?? 2} days. Didn’t ask for this? You can ignore this email.`,
          },
        ])
      : emailLayout('academy', [
          {
            heading: `Your free ${name} account`,
            intro: `Use the button below to ${user.activated ? 'log in' : 'create your player portal account'} and start on the Free plan — Level 1 of every area, video challenges, leaderboards and badges.`,
            cta: { label: 'Get started', href },
            after: 'This link works for 2 days. Didn’t ask for this? You can ignore this email.',
          },
        ])
  await sendEmail(payload, { to: email, subject: mode === 'trial' ? (o.launch ? `${name} is live — claim your free month` : `Your free month of ${name} Premium`) : `Your free ${name} account`, html, sender: 'academy', userId: user.id })
  return 'sent' as const
}

/** When Foundation+ is switched on: one "claim your free month" email to everyone on the waitlist (in batches). */
export async function sendLaunchEmails(payload: Payload, limit = 100, o: { justEnabled?: boolean } = {}) {
  // (Called from the settings hook before the change is committed, so it says so instead of re-reading)
  const enabled = o.justEnabled || (await foundationSettings(payload)).enabled
  if (!enabled) return { sent: 0, remaining: 0, skipped: 'switched off' }
  const { docs, totalDocs } = await payload.find({ collection: 'fplus-waitlist', where: { notifiedAt: { exists: false } }, limit, sort: 'createdAt', depth: 0, overrideAccess: true })
  let sent = 0
  for (const w of docs) {
    try {
      await emailLink(payload, w.email, 'trial', { ttlDays: 14, launch: true })
      await payload.update({ collection: 'fplus-waitlist', id: w.id, overrideAccess: true, data: { notifiedAt: new Date().toISOString() } })
      sent++
    } catch (e) {
      payload.logger.error({ err: e, msg: `Launch email to waitlist ${w.id} failed` })
    }
  }
  return { sent, remaining: Math.max(0, totalDocs - sent) }
}

/** Daily: the reminder 7 days before a free month ends (once). */
export async function trialReminders(payload: Payload, now = new Date()) {
  const soon = new Date(now.getTime() + 7 * 86_400_000).toISOString()
  const { docs } = await payload.find({
    collection: 'participants',
    where: { 'pdr.subscriptionStatus': { equals: 'trialing' }, 'pdr.trialEndsAt': { less_than_equal: soon, greater_than: now.toISOString() }, 'pdr.trialReminderSentAt': { exists: false } },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  const { name } = await foundationSettings(payload)
  const prices = await displayPrices(payload)
  let sent = 0
  for (const kid of docs as Participant[]) {
    const parent = kid.account ? ((await payload.findByID({ collection: 'users', id: rel(kid.account), depth: 0, overrideAccess: true, disableErrors: true })) as User | null) : null
    if (parent) {
      const end = formatDate(kid.pdr!.trialEndsAt!, { weekday: 'long', day: 'numeric', month: 'long' })
      const html = emailLayout('academy', [
        {
          heading: '7 days left of your free month',
          intro: `${esc(kid.firstName)}’s free month of ${esc(name)} Premium ends on <strong>${esc(end)}</strong>. After that it continues as Premium at <strong>${esc(formatAUD(prices.premium_month))}/month</strong> on the card you added. To switch to Standard or cancel, use Manage plan before then — no charge if you cancel before the month ends.`,
          cta: { label: 'Manage plan', href: `${siteUrl()}/foundation-plus/billing?player=${kid.id}` },
        },
      ])
      await sendEmail(payload, { to: parent.email, subject: `${name}: 7 days left of ${kid.firstName}’s free month`, html, sender: 'academy', userId: parent.id })
      sent++
    }
    await payload.update({ collection: 'participants', id: kid.id, overrideAccess: true, data: { pdr: { ...kid.pdr, trialReminderSentAt: now.toISOString() } } })
  }
  return { sent }
}

const fp = (f: string) => createHash('sha256').update(`${process.env.PAYLOAD_SECRET}|${f}`).digest('hex')

/**
 * One free month per card: when a trial starts, check the card's fingerprint. A card that already had a
 * free month (for another family) → the new trial is cancelled before any charge and the family is told.
 */
export async function guardTrialCard(payload: Payload, sub: { id: string; status: string; default_payment_method?: unknown; metadata?: Record<string, string> | null }) {
  if (sub.status !== 'trialing' || sub.id.startsWith('sim_')) return false
  const pmId = typeof sub.default_payment_method === 'string' ? sub.default_payment_method : (sub.default_payment_method as { id?: string } | null)?.id
  if (!pmId) return false
  const stripe = stripeFor('academy')
  const pm = await stripe.paymentMethods.retrieve(pmId)
  const print = pm.card?.fingerprint
  if (!print) return false
  const hash = fp(print)
  const account = Number(sub.metadata?.account) || undefined
  const player = Number(sub.metadata?.player) || undefined
  const { docs } = await payload.find({ collection: 'fplus-trial-cards', where: { fingerprint: { equals: hash } }, limit: 1, depth: 0, overrideAccess: true })
  const seen = docs[0]
  if (!seen) {
    await payload.create({ collection: 'fplus-trial-cards', overrideAccess: true, data: { fingerprint: hash, account, player, subscriptionId: sub.id } })
    return false
  }
  if (seen.subscriptionId === sub.id) return false
  await stripe.subscriptions.cancel(sub.id)
  const kid = player ? ((await payload.findByID({ collection: 'participants', id: player, depth: 0, overrideAccess: true, disableErrors: true })) as Participant | null) : null
  if (kid) {
    await logEvent(payload, { type: 'trial_blocked', kid, plan: 'premium_month', subscriptionId: sub.id })
    const parent = account ? ((await payload.findByID({ collection: 'users', id: account, depth: 0, overrideAccess: true, disableErrors: true })) as User | null) : null
    if (parent) {
      const { name } = await foundationSettings(payload)
      const html = emailLayout('academy', [
        {
          heading: 'We couldn’t start the free month',
          intro: `This card has already been used for a free month of ${esc(name)}, so we’ve cancelled the trial — nothing has been charged. You can still choose a plan for ${esc(kid.firstName)} any time.`,
          cta: { label: 'Choose a plan', href: `${siteUrl()}/foundation-plus/subscribe?player=${kid.id}` },
        },
      ])
      await sendEmail(payload, { to: parent.email, subject: `${name}: free month not available`, html, sender: 'academy', userId: parent.id })
    }
  }
  return true
}

/** A free month has started: mark the waitlist entry claimed and retire unused trial links for the family. */
export async function markTrialClaimed(payload: Payload, kid: Participant) {
  const parent = kid.account ? ((await payload.findByID({ collection: 'users', id: rel(kid.account), depth: 0, overrideAccess: true, disableErrors: true })) as User | null) : null
  if (!parent) return
  await payload.update({ collection: 'fplus-waitlist', where: { email: { equals: parent.email.toLowerCase() }, claimedAt: { exists: false } }, overrideAccess: true, data: { claimedAt: new Date().toISOString() } })
  await payload.update({ collection: 'invite-tokens', where: { user: { equals: parent.id }, purpose: { equals: 'fplus-trial' }, usedAt: { exists: false } }, overrideAccess: true, data: { usedAt: new Date().toISOString() } })
}
