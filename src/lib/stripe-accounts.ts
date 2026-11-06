import Stripe from 'stripe'

/**
 * Two independent Stripe accounts — money never touches the other entity.
 *   club    → Rowville Eagles FC          (team/season registrations)
 *   academy → Rowville Foundation Academy (1-on-1s, camps, Academy terms & trials, tournaments, shop)
 *
 * Each account has its own API key and webhook endpoint: /stripe/webhook/club and /stripe/webhook/academy.
 * A single checkout charges one account only; the shop and bookings never mix accounts in one checkout.
 */
export type Payee = 'club' | 'academy'

export const stripeAccounts: Record<Payee, { label: string; secretKeyEnv: string; webhookSecretEnv: string; refPrefix: string }> = {
  club: {
    label: 'Rowville Eagles Football Club',
    secretKeyEnv: 'STRIPE_SECRET_KEY_CLUB',
    webhookSecretEnv: 'STRIPE_WEBHOOK_SECRET_CLUB',
    refPrefix: 'REFC',
  },
  academy: {
    label: 'Rowville Foundation Academy',
    secretKeyEnv: 'STRIPE_SECRET_KEY_ACADEMY',
    webhookSecretEnv: 'STRIPE_WEBHOOK_SECRET_ACADEMY',
    refPrefix: 'RFA',
  },
}

export const isPayee = (v: unknown): v is Payee => v === 'club' || v === 'academy'

/**
 * 'stripe'   — real Stripe Checkout (test or live keys).
 * 'simulate' — LOCAL DEVELOPMENT ONLY: payments are marked paid instantly so the flow can be tested
 *              before Stripe accounts exist. Never allowed in production.
 */
export function paymentsMode(payee: Payee): 'stripe' | 'simulate' {
  if (process.env[stripeAccounts[payee].secretKeyEnv]) return 'stripe'
  if (process.env.NODE_ENV !== 'production' && process.env.PAYMENTS_SIMULATE === 'true') return 'simulate'
  throw new Error(`Online payments for ${stripeAccounts[payee].label} are not configured yet.`)
}

const clients: Partial<Record<Payee, Stripe>> = {}
export function stripeFor(payee: Payee): Stripe {
  const key = process.env[stripeAccounts[payee].secretKeyEnv]
  if (!key) throw new Error(`Missing ${stripeAccounts[payee].secretKeyEnv}`)
  // Local testing only: point the Stripe client at a mock server (never honoured in production)
  const mock = process.env.NODE_ENV !== 'production' ? process.env.STRIPE_MOCK_URL : undefined
  if (mock) {
    const u = new URL(mock)
    return (clients[payee] ??= new Stripe(key, { host: u.hostname, port: Number(u.port), protocol: u.protocol.replace(':', '') as 'http' }))
  }
  return (clients[payee] ??= new Stripe(key))
}

export function webhookSecretFor(payee: Payee): string {
  const s = process.env[stripeAccounts[payee].webhookSecretEnv]
  if (!s) throw new Error(`Missing ${stripeAccounts[payee].webhookSecretEnv}`)
  return s
}
