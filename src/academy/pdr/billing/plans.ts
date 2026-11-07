/**
 * Foundation+ plans (pure — unit tested). Prices live in Foundation+ settings and in Stripe, found by
 * lookup key so a price change never needs a code change.
 */
export type PlanKey = 'standard_month' | 'standard_year' | 'premium_month' | 'premium_year'
export type Tier = 'free' | 'standard' | 'premium'
export const PLANS: { key: PlanKey; tier: Exclude<Tier, 'free'>; interval: 'month' | 'year'; setting: 'standardMonthly' | 'standardYearly' | 'premiumMonthly' | 'premiumYearly'; name: string }[] = [
  { key: 'standard_month', tier: 'standard', interval: 'month', setting: 'standardMonthly', name: 'Foundation+ Standard' },
  { key: 'standard_year', tier: 'standard', interval: 'year', setting: 'standardYearly', name: 'Foundation+ Standard' },
  { key: 'premium_month', tier: 'premium', interval: 'month', setting: 'premiumMonthly', name: 'Foundation+ Premium' },
  { key: 'premium_year', tier: 'premium', interval: 'year', setting: 'premiumYearly', name: 'Foundation+ Premium' },
]
export const lookupKey = (k: PlanKey) => `fplus_${k}`
export const planFromLookup = (lk: string | null | undefined) => PLANS.find((p) => lookupKey(p.key) === lk) ?? null
export const planOf = (tier: string | null | undefined, period: string | null | undefined) => PLANS.find((p) => p.tier === tier && p.interval === (period === 'year' ? 'year' : 'month')) ?? null
export const DEFAULT_PRICES: Record<PlanKey, number> = { standard_month: 9.95, standard_year: 89, premium_month: 24.95, premium_year: 229 }
export const toCents = (aud: number) => Math.round(aud * 100)

export const GRACE_DAYS = 7
const DAY = 86_400_000

/**
 * What a Stripe subscription status means for the player: their tier, and whether they carry the
 * "Foundation+ player" tag. Failed payments keep access for a grace period, then drop to Free.
 */
export function subscriptionEffect(o: { status: string; plan: PlanKey | null; pastDueSince?: string | null; now?: Date; graceDays?: number }): { tier: Tier; tagged: boolean; inGrace: boolean } {
  const tier = o.plan ? PLANS.find((p) => p.key === o.plan)!.tier : 'free'
  if (o.status === 'active' || o.status === 'trialing') return { tier, tagged: true, inGrace: false }
  if (o.status === 'past_due' || o.status === 'unpaid') {
    const since = o.pastDueSince ? new Date(o.pastDueSince).getTime() : (o.now ?? new Date()).getTime()
    const ok = (o.now ?? new Date()).getTime() - since < (o.graceDays ?? GRACE_DAYS) * DAY
    return ok ? { tier, tagged: true, inGrace: true } : { tier: 'free', tagged: false, inGrace: false }
  }
  return { tier: 'free', tagged: false, inGrace: false }
}

/** The family's 2nd and later players get the sibling discount (other players already on a paid/trial plan). */
export const siblingDiscountApplies = (otherActivePlayers: number, pct: number) => pct > 0 && otherActivePlayers > 0

/** Event for the activity log when a subscription changes. */
export function lifecycleEvent(before: { status?: string | null; plan?: string | null } | null, after: { status: string; plan: string | null }) {
  const was = before?.status ?? null
  const live = (s: string | null) => s === 'active' || s === 'trialing' || s === 'past_due'
  if (after.status === 'trialing' && was !== 'trialing') return 'trial_started'
  if (after.status === 'active' && was === 'trialing') return 'trial_converted'
  if (after.status === 'active' && !live(was)) return was === 'canceled' ? 'reactivated' : 'subscribed'
  if (after.status === 'past_due' && was !== 'past_due') return 'payment_failed'
  if (after.status === 'active' && was === 'past_due') return 'payment_recovered'
  if ((after.status === 'canceled' || after.status === 'incomplete_expired') && live(was)) return was === 'trialing' ? 'trial_cancelled' : 'cancelled'
  if (after.plan && before?.plan && after.plan !== before.plan && live(after.status)) return 'plan_changed'
  return null
}
