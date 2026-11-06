/**
 * Session credit maths (pure). One credit = one 60-minute 1-on-1, whatever was paid for it.
 * Credits expire CREDIT_EXPIRY_MONTHS after they're given. Each use (or checkout reservation)
 * takes the credits that expire soonest and were valid at that moment.
 */
export const CREDIT_EXPIRY_MONTHS = 12

export type LedgerEntry = {
  id: number
  /** + given, − used */
  sessions: number
  status: 'active' | 'pending' | 'void'
  createdAt: string
  expiresAt?: string | null
}

export type CreditState = {
  available: number
  /** Soonest-expiring credits still available */
  nextExpiry: { sessions: number; at: string } | null
  /** A use couldn't be matched to valid credit (two checkouts spent the same credit) */
  overdrawn: boolean
}

export function expiryFrom(givenAt: Date) {
  const d = new Date(givenAt)
  d.setMonth(d.getMonth() + CREDIT_EXPIRY_MONTHS)
  return d.toISOString()
}

export function creditState(entries: LedgerEntry[], now = new Date()): CreditState {
  const t = (iso?: string | null) => (iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY)
  const grants = entries
    .filter((e) => e.status === 'active' && e.sessions > 0)
    .map((e) => ({ ...e, remaining: e.sessions }))
    .sort((a, b) => t(a.expiresAt) - t(b.expiresAt) || t(a.createdAt) - t(b.createdAt))
  const uses = entries.filter((e) => e.status !== 'void' && e.sessions < 0).sort((a, b) => t(a.createdAt) - t(b.createdAt))
  let overdrawn = false
  for (const u of uses) {
    let need = -u.sessions
    const at = t(u.createdAt)
    for (const g of grants) {
      if (need <= 0) break
      if (g.remaining <= 0 || t(g.createdAt) > at || t(g.expiresAt) <= at) continue
      const take = Math.min(g.remaining, need)
      g.remaining -= take
      need -= take
    }
    if (need > 0) overdrawn = true
  }
  const live = grants.filter((g) => g.remaining > 0 && t(g.expiresAt) > now.getTime())
  const first = live[0]
  return {
    available: live.reduce((n, g) => n + g.remaining, 0),
    nextExpiry: first?.expiresAt ? { sessions: live.filter((g) => g.expiresAt === first.expiresAt).reduce((n, g) => n + g.remaining, 0), at: first.expiresAt } : null,
    overdrawn,
  }
}
