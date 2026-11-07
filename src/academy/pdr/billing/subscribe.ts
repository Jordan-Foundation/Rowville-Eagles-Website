import type { Payload } from 'payload'
import type { Participant, User } from '@/payload-types'
import { siteUrl } from '../../../lib/payments'
import { stripeFor } from '../../../lib/stripe-accounts'
import { foundationSettings } from '../load'
import { PLANS, siblingDiscountApplies, type PlanKey } from './plans'
import { billingMode, subscriptionCheckout } from './stripe'
import { applySubscription } from './sync'

export class BillingError extends Error {}
const LIVE = new Set(['active', 'trialing', 'past_due'])
const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number))

export async function familyPlayers(payload: Payload, user: User) {
  const { docs } = await payload.find({ collection: 'participants', where: { account: { equals: user.id } }, sort: 'firstName', limit: 20, depth: 0, overrideAccess: true })
  return docs as Participant[]
}

/** Start a plan for one of the family's players. Returns where to send them next. */
export async function startSubscription(payload: Payload, user: User, o: { playerId: number; plan: PlanKey; trialDays?: number }) {
  const settings = await foundationSettings(payload)
  if (!settings.enabled && !user.roles?.some((r) => r === 'admin' || r === 'committee')) throw new BillingError('Foundation+ isn’t open for sign-ups yet.')
  const kids = await familyPlayers(payload, user)
  const kid = kids.find((k) => k.id === o.playerId)
  if (!kid) throw new BillingError('Choose one of your players.')
  if (!PLANS.some((p) => p.key === o.plan)) throw new BillingError('Choose a plan.')
  if (kid.pdr?.subscriptionId && LIVE.has(kid.pdr.subscriptionStatus ?? '')) throw new BillingError(`${kid.firstName} already has a plan — use “Manage plan” to change it.`)
  const s = await payload.findGlobal({ slug: 'pdr-settings', depth: 0, overrideAccess: true })
  const others = kids.filter((k) => k.id !== kid.id && LIVE.has(k.pdr?.subscriptionStatus ?? '')).length
  const pct = s.plans?.siblingDiscountPct ?? 25
  const siblingPct = siblingDiscountApplies(others, pct) ? pct : 0
  const mode = billingMode()
  if (mode === 'stripe') {
    return subscriptionCheckout(payload, {
      user,
      playerId: kid.id,
      plan: o.plan,
      trialDays: o.trialDays,
      siblingPct,
      successUrl: `${siteUrl()}/foundation-plus/subscribe/done?player=${kid.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${siteUrl()}/foundation-plus/subscribe?player=${kid.id}&plan=${o.plan}&cancelled=1`,
    })
  }
  if (mode === 'simulate') {
    // Local testing without Stripe: behave as if the subscription started
    const now = Math.floor(Date.now() / 1000)
    await applySubscription(payload, {
      id: `sim_sub_${kid.id}_${now}`,
      status: o.trialDays ? 'trialing' : 'active',
      metadata: { kind: 'fplus', player: String(kid.id), account: String(user.id), plan: o.plan },
      trial_end: o.trialDays ? now + o.trialDays * 86400 : null,
      current_period_end: now + (o.trialDays ?? (o.plan.endsWith('year') ? 365 : 30)) * 86400,
      cancel_at_period_end: false,
    })
    return `/foundation-plus/subscribe/done?player=${kid.id}`
  }
  throw new BillingError('Online payments aren’t set up yet — please try again soon.')
}

/** After Checkout: apply the subscription straight away (the webhook does the same, whichever comes first). */
export async function confirmCheckout(payload: Payload, sessionId: string) {
  if (billingMode() !== 'stripe' || !/^cs_[\w]+$/.test(sessionId)) return null
  const stripe = stripeFor('academy')
  const session = await stripe.checkout.sessions.retrieve(sessionId)
  if (session.mode !== 'subscription' || session.metadata?.kind !== 'fplus' || !session.subscription) return null
  const sub = await stripe.subscriptions.retrieve(typeof session.subscription === 'string' ? session.subscription : session.subscription.id, { expand: ['items.data.price'] })
  const { guardTrialCard } = await import('./trial')
  const blocked = await guardTrialCard(payload, sub as never)
  return applySubscription(payload, (blocked ? { ...sub, status: 'canceled' } : sub) as never)
}

export const ownsPlayer = (kid: Participant | null, user: User) => Boolean(kid && rel(kid.account) === user.id)
