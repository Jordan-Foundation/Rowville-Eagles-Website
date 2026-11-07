import type { Payload } from 'payload'
import type { Participant, User } from '@/payload-types'
import { sendEmail } from '../../../lib/email'
import { emailLayout, esc } from '../../../lib/email-templates'
import { formatDate } from '../../../lib/format'
import { siteUrl } from '../../../lib/payments'
import { foundationSettings } from '../load'
import { GRACE_DAYS, lifecycleEvent, planFromLookup, PLANS, subscriptionEffect, type PlanKey } from './plans'

const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number))
const iso = (unix: number | null | undefined) => (unix ? new Date(unix * 1000).toISOString() : null)

/** The parts of a Stripe Subscription we use (also built by hand in simulate mode). */
export type SubLike = {
  id: string
  status: string
  metadata?: Record<string, string> | null
  cancel_at_period_end?: boolean | null
  trial_end?: number | null
  current_period_end?: number | null
  items?: { data: { price?: { lookup_key?: string | null } | null; current_period_end?: number | null }[] } | null
}

const ENDED = new Set(['canceled', 'incomplete_expired'])
const tierName = (plan: PlanKey | null) => (plan ? PLANS.find((p) => p.key === plan)!.tier.replace(/^./, (c) => c.toUpperCase()) : 'Free')

/** Bring a player's Foundation+ plan, status and "Foundation+ player" tag in line with Stripe. */
export async function applySubscription(payload: Payload, sub: SubLike, now = new Date()) {
  let kid: Participant | null = null
  const pid = Number(sub.metadata?.player)
  if (pid) kid = (await payload.findByID({ collection: 'participants', id: pid, depth: 0, overrideAccess: true, disableErrors: true })) as Participant | null
  if (!kid) kid = ((await payload.find({ collection: 'participants', where: { 'pdr.subscriptionId': { equals: sub.id } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] as Participant) ?? null
  if (!kid) {
    payload.logger.error(`Foundation+ subscription ${sub.id} has no matching player`)
    return null
  }
  const pdr = kid.pdr ?? {}
  // An old subscription ending must not wipe out a newer one
  if (pdr.subscriptionId && pdr.subscriptionId !== sub.id && ENDED.has(sub.status) && !ENDED.has(pdr.subscriptionStatus ?? '')) return kid

  const plan = (planFromLookup(sub.items?.data?.[0]?.price?.lookup_key)?.key ?? (sub.metadata?.plan as PlanKey | undefined) ?? (pdr.plan as PlanKey | undefined) ?? null) as PlanKey | null
  const pastDueSince = sub.status === 'past_due' || sub.status === 'unpaid' ? (pdr.pastDueSince ?? now.toISOString()) : null
  const effect = subscriptionEffect({ status: sub.status, plan, pastDueSince, now })
  const before = { status: pdr.subscriptionId === sub.id ? pdr.subscriptionStatus : null, plan: pdr.plan }
  const tags = new Set(kid.memberships ?? [])
  if (effect.tagged) tags.add('foundation-plus')
  else tags.delete('foundation-plus')

  const updated = (await payload.update({
    collection: 'participants',
    id: kid.id,
    overrideAccess: true,
    data: {
      memberships: [...tags],
      pdr: {
        ...pdr,
        tier: effect.tier,
        subscriptionId: sub.id,
        subscriptionStatus: sub.status,
        plan,
        trialEndsAt: iso(sub.trial_end),
        currentPeriodEnd: iso(sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end),
        cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
        pastDueSince,
        trialUsedAt: pdr.trialUsedAt ?? (sub.status === 'trialing' ? now.toISOString() : null),
      },
    },
  })) as Participant

  const type = lifecycleEvent(before, { status: sub.status, plan })
  if (type) await logEvent(payload, { type, kid: updated, plan, subscriptionId: sub.id })
  if (type) await notify(payload, type, updated, plan)
  return updated
}

export async function logEvent(payload: Payload, o: { type: string; kid: Participant; plan: string | null; subscriptionId?: string; amount?: number }) {
  const label: Record<string, string> = {
    trial_started: 'started a free month',
    trial_converted: 'converted from trial to paid',
    trial_cancelled: 'cancelled during the free month',
    subscribed: 'subscribed',
    reactivated: 'subscribed again',
    plan_changed: 'changed plan',
    payment_failed: 'payment failed',
    payment_recovered: 'payment recovered',
    cancelled: 'cancelled',
    grace_expired: 'dropped to Free after failed payments',
    trial_blocked: 'free month refused (already used)',
  }
  await payload.create({
    collection: 'fplus-events',
    overrideAccess: true,
    data: { type: o.type as never, plan: o.plan ?? undefined, amount: o.amount, player: o.kid.id, account: rel(o.kid.account) || undefined, subscriptionId: o.subscriptionId, summary: `${o.kid.firstName} ${o.kid.lastName} ${label[o.type] ?? o.type}${o.plan ? ` (${o.plan.replace('_', ' / ')})` : ''}` },
  })
}

async function notify(payload: Payload, type: string, kid: Participant, plan: PlanKey | null) {
  const parent = kid.account ? ((await payload.findByID({ collection: 'users', id: rel(kid.account), depth: 0, overrideAccess: true, disableErrors: true })) as User | null) : null
  if (!parent) return
  const { name } = await foundationSettings(payload)
  const page = `${siteUrl()}/foundation-plus/${kid.id}`
  const tier = tierName(plan)
  const msgs: Record<string, { subject: string; heading: string; intro: string; label: string } | undefined> = {
    subscribed: { subject: `Welcome to ${name} ${tier}`, heading: `Welcome to ${tier}`, intro: `${esc(kid.firstName)} is now on ${esc(name)} <strong>${esc(tier)}</strong>. Everything is unlocked on their player page — time to train!`, label: `Open ${kid.firstName}’s player page` },
    reactivated: { subject: `Welcome back to ${name}`, heading: 'Welcome back', intro: `${esc(kid.firstName)} is back on ${esc(name)} <strong>${esc(tier)}</strong>. Their progress was kept.`, label: `Open ${kid.firstName}’s player page` },
    plan_changed: { subject: `${name}: plan changed to ${tier}`, heading: 'Plan changed', intro: `${esc(kid.firstName)} is now on <strong>${esc(tier)}</strong>.`, label: 'Open the player page' },
    payment_failed: {
      subject: `${name}: payment didn’t go through`,
      heading: 'Payment didn’t go through',
      intro: `We couldn’t take the payment for ${esc(kid.firstName)}’s ${esc(name)} plan. Please update your card — ${esc(kid.firstName)} keeps access for ${GRACE_DAYS} days while we try again.`,
      label: 'Update payment details',
    },
    cancelled: {
      subject: `${name}: plan ended`,
      heading: 'Plan ended',
      intro: `${esc(kid.firstName)}’s ${esc(name)} plan has ended and they’re back on the Free plan. Their progress, scores and badges are kept — you can come back any time.`,
      label: 'See plans',
    },
  }
  const m = msgs[type]
  if (!m) return
  const href = type === 'payment_failed' ? `${siteUrl()}/foundation-plus/billing?player=${kid.id}` : type === 'cancelled' ? `${siteUrl()}/foundation-plus#pricing` : page
  const html = emailLayout('academy', [{ heading: m.heading, intro: m.intro, cta: { label: m.label, href }, after: kid.pdr?.currentPeriodEnd && type !== 'cancelled' ? `Current period ends ${esc(formatDate(kid.pdr.currentPeriodEnd, { day: 'numeric', month: 'long', year: 'numeric' }))}. Manage or cancel any time from the player page.` : undefined }])
  await sendEmail(payload, { to: parent.email, subject: m.subject, html, sender: 'academy', userId: parent.id })
}

/** Daily: players whose payments have been failing past the grace period drop to Free. */
export async function graceSweep(payload: Payload, now = new Date()) {
  const cutoff = new Date(now.getTime() - GRACE_DAYS * 86_400_000).toISOString()
  const { docs } = await payload.find({
    collection: 'participants',
    where: { 'pdr.subscriptionStatus': { in: ['past_due', 'unpaid'] }, 'pdr.pastDueSince': { less_than: cutoff }, 'pdr.tier': { not_equals: 'free' } },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  for (const kid of docs) {
    await payload.update({ collection: 'participants', id: kid.id, overrideAccess: true, data: { memberships: (kid.memberships ?? []).filter((m) => m !== 'foundation-plus'), pdr: { ...kid.pdr, tier: 'free' } } })
    await logEvent(payload, { type: 'grace_expired', kid, plan: kid.pdr?.plan ?? null, subscriptionId: kid.pdr?.subscriptionId ?? undefined })
  }
  return { downgraded: docs.length }
}
