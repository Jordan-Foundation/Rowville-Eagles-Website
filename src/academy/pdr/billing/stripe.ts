import type Stripe from 'stripe'
import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import { paymentsMode, stripeFor } from '../../../lib/stripe-accounts'
import { DEFAULT_PRICES, lookupKey, PLANS, toCents, type PlanKey } from './plans'

/**
 * Foundation+ on the Academy Stripe account. Prices are found by lookup key (fplus_premium_month …); when
 * an amount changes in the admin a new Price is created and the lookup key moves to it (Stripe prices
 * can't be edited — existing subscribers keep their price until changed in Stripe).
 */
export const billingMode = () => {
  try {
    return paymentsMode('academy')
  } catch {
    return null
  }
}

export async function settingsPrices(payload: Payload): Promise<Record<PlanKey, number>> {
  const s = await payload.findGlobal({ slug: 'pdr-settings', depth: 0, overrideAccess: true })
  const pl = (s.plans ?? {}) as Record<string, number | null | undefined>
  return Object.fromEntries(PLANS.map((p) => [p.key, pl[p.setting] ?? DEFAULT_PRICES[p.key]])) as Record<PlanKey, number>
}

/** Make Stripe match the admin prices (creates products/prices the first time). Returns the Stripe price ids. */
export async function syncPlanPrices(payload: Payload) {
  if (billingMode() !== 'stripe') return null
  const stripe = stripeFor('academy')
  const want = await settingsPrices(payload)
  const { data } = await stripe.prices.list({ lookup_keys: PLANS.map((p) => lookupKey(p.key)), active: true, limit: 10 })
  const byKey = new Map(data.map((p) => [p.lookup_key, p]))
  const products = new Map<string, string>()
  for (const p of data) products.set(p.recurring?.interval === 'year' ? `${p.metadata?.tier}` : `${p.metadata?.tier}`, typeof p.product === 'string' ? p.product : p.product.id)
  const ids: Partial<Record<PlanKey, string>> = {}
  for (const plan of PLANS) {
    const lk = lookupKey(plan.key)
    const cur = byKey.get(lk)
    if (cur && cur.unit_amount === toCents(want[plan.key]) && cur.currency === 'aud') {
      ids[plan.key] = cur.id
      continue
    }
    let product = products.get(plan.tier)
    if (!product) {
      product = (await stripe.products.create({ name: plan.name, metadata: { kind: 'fplus', tier: plan.tier } })).id
      products.set(plan.tier, product)
    }
    const price = await stripe.prices.create({
      product,
      currency: 'aud',
      unit_amount: toCents(want[plan.key]),
      recurring: { interval: plan.interval },
      lookup_key: lk,
      transfer_lookup_key: true,
      metadata: { kind: 'fplus', tier: plan.tier, plan: plan.key },
    })
    ids[plan.key] = price.id
  }
  return ids as Record<PlanKey, string>
}

let cache: { at: number; prices: Record<PlanKey, number> } | null = null
/** Prices to show families: from Stripe when connected (10-minute cache), otherwise the admin settings. */
export async function displayPrices(payload: Payload): Promise<Record<PlanKey, number>> {
  const fallback = await settingsPrices(payload)
  if (billingMode() !== 'stripe') return fallback
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.prices
  try {
    const { data } = await stripeFor('academy').prices.list({ lookup_keys: PLANS.map((p) => lookupKey(p.key)), active: true, limit: 10 })
    const prices = { ...fallback }
    for (const p of data) {
      const plan = PLANS.find((x) => lookupKey(x.key) === p.lookup_key)
      if (plan && p.unit_amount != null) prices[plan.key] = p.unit_amount / 100
    }
    cache = { at: Date.now(), prices }
    return prices
  } catch {
    return fallback
  }
}
export const clearPriceCache = () => {
  cache = null
}

/** One Stripe customer per family account (Academy account). */
export async function customerFor(payload: Payload, user: User) {
  const stripe = stripeFor('academy')
  if (user.stripeCustomerAcademy) return user.stripeCustomerAcademy
  const c = await stripe.customers.create({ email: user.email, name: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined, metadata: { account: String(user.id) } })
  await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { stripeCustomerAcademy: c.id } })
  return c.id
}

/** A coupon for the 2nd+ player discount (one per percentage, created once). */
export async function siblingCoupon(pct: number) {
  const stripe = stripeFor('academy')
  const id = `fplus_sibling_${pct}`
  try {
    await stripe.coupons.retrieve(id)
  } catch {
    await stripe.coupons.create({ id, percent_off: pct, duration: 'forever', name: `Foundation+ — ${pct}% off 2nd+ player` })
  }
  return id
}

export type CheckoutOpts = {
  user: User
  playerId: number
  plan: PlanKey
  trialDays?: number
  siblingPct?: number
  /** A promotion's discount on the first payment (used instead of the sibling discount when it's bigger). */
  promo?: { type: 'percent' | 'amount'; value: number; name: string; ref: string } | null
  successUrl: string
  cancelUrl: string
}

/** Stripe Checkout in subscription mode. The card is always collected (also for free trials). */
export async function subscriptionCheckout(payload: Payload, o: CheckoutOpts) {
  const stripe = stripeFor('academy')
  const ids = (await syncPlanPrices(payload))!
  const customer = await customerFor(payload, o.user)
  const metadata: Record<string, string> = { kind: 'fplus', player: String(o.playerId), account: String(o.user.id), plan: o.plan, ...(o.promo ? { promoRef: o.promo.ref } : {}) }
  const promoCoupon = o.promo
    ? await stripe.coupons.create({ ...(o.promo.type === 'percent' ? { percent_off: Math.min(o.promo.value, 100) } : { amount_off: Math.round(o.promo.value * 100), currency: 'aud' }), duration: 'once', max_redemptions: 1, name: o.promo.name.slice(0, 40) })
    : null
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    customer,
    line_items: [{ price: ids[o.plan], quantity: 1 }],
    payment_method_collection: 'always',
    subscription_data: { metadata, ...(o.trialDays ? { trial_period_days: o.trialDays, trial_settings: { end_behavior: { missing_payment_method: 'cancel' } } } : {}) },
    metadata,
    ...(promoCoupon ? { discounts: [{ coupon: promoCoupon.id }] } : o.siblingPct ? { discounts: [{ coupon: await siblingCoupon(o.siblingPct) }] } : { allow_promotion_codes: true }),
    success_url: o.successUrl,
    cancel_url: o.cancelUrl,
  }
  const session = await stripe.checkout.sessions.create(params, { idempotencyKey: `fplus-${o.user.id}-${o.playerId}-${o.plan}-${Math.floor(Date.now() / 60_000)}` })
  return session.url!
}

export async function billingPortalUrl(payload: Payload, user: User, returnUrl: string) {
  const customer = await customerFor(payload, user)
  const s = await stripeFor('academy').billingPortal.sessions.create({ customer, return_url: returnUrl })
  return s.url
}
