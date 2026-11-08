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
  const { docs } = await payload.find({ pagination: false, collection: 'participants', where: { account: { equals: user.id } }, sort: 'firstName', limit: 20, depth: 0, overrideAccess: true })
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
  let siblingPct = siblingDiscountApplies(others, pct) ? pct : 0
  // Promotion on the first payment (not during a free trial); the bigger of it and the sibling discount applies
  const planDef = PLANS.find((x) => x.key === o.plan)!
  const price = Number((s.plans as Record<string, number | null | undefined> | undefined)?.[planDef.setting] ?? 0)
  const { findDiscount, recordUse, settleUses } = await import('../../../promotions/service')
  const promo = o.trialDays ? null : await findDiscount(payload, user.id, [{ target: { kind: 'fplus' }, amount: price }])
  const usePromo = promo && promo.off > (price * siblingPct) / 100 ? promo : null
  let promoArg: { type: 'percent' | 'amount'; value: number; name: string; ref: string } | null = null
  if (usePromo) {
    const d = await payload.findByID({ collection: 'promotions', id: usePromo.promotion, depth: 0, overrideAccess: true })
    const ref = `FP-${kid.id}-${Date.now().toString(36).toUpperCase()}`
    promoArg = { type: d.type, value: d.value, name: usePromo.label, ref }
    siblingPct = 0
    await recordUse(payload, { applied: usePromo, account: user.id, kind: 'fplus', reference: ref, paidAmount: Math.round((price - usePromo.off) * 100) / 100 })
  }
  const mode = billingMode()
  if (mode === 'stripe') {
    return subscriptionCheckout(payload, {
      user,
      playerId: kid.id,
      plan: o.plan,
      trialDays: o.trialDays,
      siblingPct,
      promo: promoArg,
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
    if (promoArg) await settleUses(payload, promoArg.ref, 'paid')
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
  if (session.metadata?.promoRef && session.payment_status === 'paid') await (await import('../../../promotions/service')).settleUses(payload, session.metadata.promoRef, 'paid')
  return applySubscription(payload, (blocked ? { ...sub, status: 'canceled' } : sub) as never)
}

export const ownsPlayer = (kid: Participant | null, user: User) => Boolean(kid && rel(kid.account) === user.id)
