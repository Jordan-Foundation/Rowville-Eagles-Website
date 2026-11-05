/**
 * Two independent Stripe accounts — money never touches the other entity.
 *   club    → Rowville Eagles FC          (team/season registrations)
 *   academy → Rowville Foundation Academy (1-on-1s, camps, Academy terms & trials, tournaments)
 *
 * Each account has its own API key and its own webhook endpoint:
 *   /api/stripe/webhook/club  and  /api/stripe/webhook/academy
 * Checkout (Phase 3) picks the account from Program.payee. A single checkout can only
 * charge one account, so a cart mixing club + academy items is split into two payments.
 */
export type Payee = 'club' | 'academy'

export const stripeAccounts: Record<Payee, { label: string; secretKeyEnv: string; webhookSecretEnv: string }> = {
  club: {
    label: 'Rowville Eagles Football Club',
    secretKeyEnv: 'STRIPE_SECRET_KEY_CLUB',
    webhookSecretEnv: 'STRIPE_WEBHOOK_SECRET_CLUB',
  },
  academy: {
    label: 'Rowville Foundation Academy',
    secretKeyEnv: 'STRIPE_SECRET_KEY_ACADEMY',
    webhookSecretEnv: 'STRIPE_WEBHOOK_SECRET_ACADEMY',
  },
}

export function stripeSecretFor(payee: Payee): string {
  const key = process.env[stripeAccounts[payee].secretKeyEnv]
  if (!key) throw new Error(`Missing ${stripeAccounts[payee].secretKeyEnv} — Stripe account for ${payee} is not configured`)
  return key
}
