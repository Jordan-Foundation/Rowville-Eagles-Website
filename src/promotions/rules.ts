/**
 * Promotions — what a promotion covers and how much it takes off (pure — unit tested).
 * A promotion can cover anything that costs money on the website.
 */

/** Something a family is about to pay for. */
export type Target =
  | { kind: 'program'; programId: number; programType: string } // camps, registrations, group terms, Mini Ballers, trials, other programs
  | { kind: '1on1'; termId: number }
  | { kind: 'shop'; productId: number }
  | { kind: 'tournament'; roundId: number }
  | { kind: 'fplus' }

/** Program types that can be picked as a whole group. */
export const PROGRAM_GROUPS = [
  { value: 'holiday-camp', label: 'All holiday camps' },
  { value: 'academy-term', label: 'All Academy group terms' },
  { value: 'toddler', label: 'All Mini Ballers' },
  { value: 'academy-trial', label: 'All Academy trial sessions' },
  { value: 'registration', label: 'All season registrations' },
  { value: 'other', label: 'All other programs' },
] as const
const GROUPED = new Set<string>(PROGRAM_GROUPS.map((g) => g.value).filter((v) => v !== 'other'))

export type Scope = {
  everything?: boolean | null
  programGroups?: string[] | null
  programs?: number[] | null
  oneOnOneAll?: boolean | null
  oneOnOneTerms?: number[] | null
  shopAll?: boolean | null
  products?: number[] | null
  tournamentsAll?: boolean | null
  tournamentRounds?: number[] | null
  foundationPlus?: boolean | null
}

/** Does the promotion cover this purchase? */
export function covers(s: Scope, t: Target): boolean {
  if (s.everything) return true
  switch (t.kind) {
    case 'program': {
      const groups = s.programGroups ?? []
      if ((s.programs ?? []).includes(t.programId)) return true
      if (groups.includes(t.programType)) return true
      return groups.includes('other') && !GROUPED.has(t.programType)
    }
    case '1on1':
      return !!s.oneOnOneAll || (s.oneOnOneTerms ?? []).includes(t.termId)
    case 'shop':
      return !!s.shopAll || (s.products ?? []).includes(t.productId)
    case 'tournament':
      return !!s.tournamentsAll || (s.tournamentRounds ?? []).includes(t.roundId)
    case 'fplus':
      return !!s.foundationPlus
  }
}

/** Nothing picked at all (can't be made live). */
export const scopeEmpty = (s: Scope) =>
  !s.everything && !(s.programGroups ?? []).length && !(s.programs ?? []).length && !s.oneOnOneAll && !(s.oneOnOneTerms ?? []).length && !s.shopAll && !(s.products ?? []).length && !s.tournamentsAll && !(s.tournamentRounds ?? []).length && !s.foundationPlus

export type Discount = { type: 'percent' | 'amount'; value: number }

const cents = (n: number) => Math.round(n * 100) / 100

/** Dollars off an eligible amount: a percentage, or a fixed amount (never more than the amount). */
export function amountOff(d: Discount, eligible: number) {
  if (!(eligible > 0) || !(d.value > 0)) return 0
  const off = d.type === 'percent' ? (eligible * Math.min(d.value, 100)) / 100 : d.value
  return cents(Math.min(off, eligible))
}

export type LivePromo = Scope & Discount & { id: number; name: string; startsAt?: string | null; endsAt?: string | null; usesPerFamily?: number | null; status: string }

/** Can this family use it right now? (live, in its dates, uses left) */
export function usable(p: LivePromo, usesSoFar: number, now = new Date()) {
  if (p.status !== 'live') return false
  if (p.startsAt && Date.parse(p.startsAt) > now.getTime()) return false
  if (p.endsAt && Date.parse(p.endsAt) < now.getTime()) return false
  return !(p.usesPerFamily && usesSoFar >= p.usesPerFamily)
}

/** The family's best promotion for a purchase (the biggest saving), or null. `eligible` maps a promotion to the amount it covers. */
export function bestPromo(promos: LivePromo[], uses: Map<number, number>, eligible: (p: LivePromo) => number, now = new Date()) {
  let best: { promo: LivePromo; off: number } | null = null
  for (const p of promos) {
    if (!usable(p, uses.get(p.id) ?? 0, now)) continue
    const off = amountOff(p, eligible(p))
    if (off > 0 && (!best || off > best.off)) best = { promo: p, off }
  }
  return best
}

/** "20% off" / "$15 off" */
export const discountLabel = (d: Discount) => (d.type === 'percent' ? `${d.value}% off` : `$${Number.isInteger(d.value) ? d.value : d.value.toFixed(2)} off`)

/** Spread a dollar discount across lines in proportion to their value (used for shop items / per-registration amounts). Totals match exactly. */
export function spread(off: number, amounts: number[]) {
  const total = amounts.reduce((a, b) => a + b, 0)
  if (!total || !off) return amounts.map(() => 0)
  const shares = amounts.map((a) => Math.floor(((off * a) / total) * 100) / 100)
  let rest = Math.round((off - shares.reduce((a, b) => a + b, 0)) * 100)
  for (let i = 0; rest > 0 && i < shares.length; i++, rest--) shares[i] = cents(shares[i] + 0.01)
  return shares
}
