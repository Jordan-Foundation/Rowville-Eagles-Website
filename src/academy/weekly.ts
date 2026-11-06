/**
 * Weekly payment plan for a term of 1-on-1s (pure — no database or Stripe calls).
 *
 * Session 1 is paid at checkout. Every later session is charged automatically
 * CHARGE_LEAD_HOURS before it starts, so a failed card is known (and retried) before the
 * family turns up. The Stripe subscription starts charging at the session-2 charge, repeats
 * every 7 days, and is told to cancel itself just after the final charge.
 */
export const CHARGE_LEAD_HOURS = 48

const HOUR = 3600_000
const WEEK = 7 * 24 * HOUR

export type WeeklyPlan = {
  /** When each session is charged (index 0 = today, at checkout) */
  chargeDates: string[]
  /** Unix seconds: first automatic charge (session 2) — the subscription's billing anchor */
  anchor: number
  /** Unix seconds: the subscription cancels itself here, after the last charge and before the next */
  cancelAt: number
  /** Automatic charges after checkout */
  recurringCharges: number
}

/**
 * Stripe repeats exactly every 7 × 24h, while sessions keep the same local (Sydney) time, so
 * across a daylight-saving change charge and session drift by an hour — well inside the 48h lead.
 */
export function weeklyPlan(sessions: string[], now = new Date()): WeeklyPlan | null {
  if (sessions.length < 2) return null
  const second = new Date(sessions[1]).getTime()
  const anchorMs = second - CHARGE_LEAD_HOURS * HOUR
  // Stripe needs the first automatic charge at least 48h away (it's always ~6+ days, given the 24h cutoff)
  if (anchorMs <= now.getTime() + 49 * HOUR) return null
  const recurringCharges = sessions.length - 1
  const lastChargeMs = anchorMs + (recurringCharges - 1) * WEEK
  const chargeDates = [now.toISOString(), ...Array.from({ length: recurringCharges }, (_, i) => new Date(anchorMs + i * WEEK).toISOString())]
  return {
    chargeDates,
    anchor: Math.floor(anchorMs / 1000),
    cancelAt: Math.floor((lastChargeMs + 24 * HOUR) / 1000),
    recurringCharges,
  }
}

/** The next automatic charge after `paid` sessions are paid, or null once everything is paid. */
export function nextChargeAt(plan: Pick<WeeklyPlan, 'anchor' | 'recurringCharges'>, paid: number): string | null {
  const k = paid - 1 // charges already taken after checkout
  if (k >= plan.recurringCharges) return null
  return new Date((plan.anchor + k * 7 * 24 * 3600) * 1000).toISOString()
}
