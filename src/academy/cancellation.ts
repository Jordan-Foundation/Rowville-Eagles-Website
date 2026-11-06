/**
 * Foundation Academy cancellation policy (pure — no database or Stripe calls).
 *
 *  Casual session, family cancels  ≥ cutoff (24h) before → full value back (refund or credit)
 *                                   < cutoff             → nothing back
 *  Term booking, family cancels     unplayed sessions back, less one session
 *  One week of a term, family       same as casual: ≥ cutoff → that session back; < cutoff → nothing
 *  Coach cancels (any)              free make-up session, or the session's value back
 *
 * "Back" means money the family has actually paid for those sessions. On a weekly plan only sessions
 * already charged count; cancelling the whole plan also stops future charges. Whatever comes back
 * is a refund to card up to the cash still refundable on the booking — the rest is account credit.
 */

export type CancelBy = 'family' | 'coach'
export type Outcome = 'refund' | 'credit' | 'makeup' | 'none'

export type QuoteBooking = {
  type: 'casual' | 'term'
  paymentMode: 'casual' | 'upfront' | 'weekly'
  /** Full price of the booking (AUD) */
  amount: number
  sessionsTotal: number
  /** Account credit used at checkout (AUD) */
  creditApplied?: number | null
  /** Weekly plans: sessions charged so far (incl. today's at checkout) */
  sessionsPaid?: number | null
  refundedAmount?: number | null
  creditedAmount?: number | null
}

export type QuoteSession = { id: number; startsAt: string; status: string; paid?: boolean | null }

export type Quote = {
  /** Sessions that will be cancelled */
  sessionIds: number[]
  perSession: number
  /** Sessions whose value comes back */
  sessionsBack: number
  /** AUD coming back under the policy */
  value: number
  /** Most that can go back to the card */
  refundableCash: number
  /** Most that can come back in total, for a goodwill override (paid, less anything already returned) */
  maxReturn: number
  options: Outcome[]
  stopWeekly: boolean
  rule: string
  warnings: string[]
}

const round = (n: number) => Math.round(n * 100) / 100
const HOUR = 3600_000

/** Cash (card) the family has paid on this booking. */
export function cashPaid(b: QuoteBooking) {
  const per = b.amount / (b.sessionsTotal || 1)
  const gross = b.paymentMode === 'weekly' ? per * (b.sessionsPaid ?? 0) : b.amount
  return round(Math.max(0, gross - (b.creditApplied ?? 0)))
}

/** Everything paid for (cash + credit used). */
export const totalPaid = (b: QuoteBooking) => round(cashPaid(b) + (b.creditApplied ?? 0))

export function quoteCancellation(input: {
  booking: QuoteBooking
  /** Live sessions on the booking (held/scheduled/completed/no_show — not cancelled) */
  sessions: QuoteSession[]
  /** 'booking' = everything still to come; otherwise specific session ids */
  cancel: 'booking' | number[]
  by: CancelBy
  now: Date
  cutoffHours?: number
}): Quote {
  const { booking: b, by, now } = input
  const cutoff = (input.cutoffHours ?? 24) * HOUR
  const perSession = round(b.amount / (b.sessionsTotal || 1))
  const upcoming = input.sessions.filter((s) => s.status === 'scheduled' && new Date(s.startsAt).getTime() > now.getTime())
  const targets = input.cancel === 'booking' ? upcoming : upcoming.filter((s) => (input.cancel as number[]).includes(s.id))
  const warnings: string[] = []
  if (input.cancel !== 'booking' && targets.length < (input.cancel as number[]).length) warnings.push('Sessions that have already started or been marked can’t be cancelled — mark attendance instead.')

  const returned = (b.refundedAmount ?? 0) + (b.creditedAmount ?? 0)
  const maxReturn = round(Math.max(0, totalPaid(b) - returned))
  const refundableCash = round(Math.max(0, cashPaid(b) - (b.refundedAmount ?? 0)))
  const weekly = b.paymentMode === 'weekly'
  const remainingAfter = upcoming.length - targets.length
  const stopWeekly = weekly && targets.length > 0 && remainingAfter === 0
  const paidCount = (list: QuoteSession[]) => (weekly ? list.filter((s) => s.paid).length : list.length)

  let sessionsBack = 0
  let rule: string
  if (!targets.length) {
    rule = 'Nothing to cancel — no upcoming sessions selected.'
  } else if (by === 'coach') {
    // Weekly plan being stopped: only weeks already charged; otherwise every cancelled week (it's charged anyway)
    sessionsBack = stopWeekly ? paidCount(targets) : targets.length
    rule = 'Coach cancellation: free make-up session, or the session’s value back.'
  } else if (b.type === 'term' && input.cancel === 'booking') {
    const back = Math.max(0, paidCount(targets) - 1)
    sessionsBack = back
    rule = weekly
      ? `Term cancelled: ${paidCount(targets)} already-paid unplayed session${paidCount(targets) === 1 ? '' : 's'}, less one session. Future weekly charges stop.`
      : `Term cancelled: ${targets.length} unplayed session${targets.length === 1 ? '' : 's'}, less one session.`
  } else {
    // Casual, or single weeks of a term: the 24-hour rule per session
    const early = targets.filter((s) => new Date(s.startsAt).getTime() - now.getTime() >= cutoff)
    const late = targets.length - early.length
    sessionsBack = weekly ? early.filter((s) => s.paid).length : early.length
    rule =
      late === targets.length
        ? `Cancelled less than ${input.cutoffHours ?? 24} hours before — no refund or credit under the policy.`
        : late > 0
          ? `${early.length} cancelled ${input.cutoffHours ?? 24}+ hours ahead (value back); ${late} inside ${input.cutoffHours ?? 24} hours (no refund).`
          : `Cancelled ${input.cutoffHours ?? 24}+ hours before — value back as a refund or credit.`
    if (weekly && early.some((s) => !s.paid)) {
      // Not charged yet, but the weekly plan will still charge for it — give credit for that week instead
      const unpaidEarly = early.filter((s) => !s.paid).length
      sessionsBack += unpaidEarly
      warnings.push(`${unpaidEarly} of these week${unpaidEarly === 1 ? ' hasn’t' : 's haven’t'} been charged yet — the weekly plan still charges for ${unpaidEarly === 1 ? 'it' : 'them'}, so the value comes back as credit.`)
    }
  }

  const value = round(Math.min(sessionsBack * perSession, by === 'coach' ? Number.POSITIVE_INFINITY : maxReturn))
  const options: Outcome[] = []
  if (by === 'coach' && targets.length) options.push('makeup')
  if (value > 0 && refundableCash > 0) options.push('refund')
  if (value > 0) options.push('credit')
  if (!options.length) options.push('none')
  return { sessionIds: targets.map((s) => s.id), perSession, sessionsBack, value, refundableCash, maxReturn, options, stopWeekly, rule, warnings }
}

/** Split an amount between card refund (up to what's refundable) and account credit. */
export function splitReturn(amount: number, outcome: Outcome, refundableCash: number) {
  if (outcome === 'refund') {
    const cash = round(Math.min(amount, refundableCash))
    return { cash, credit: round(amount - cash) }
  }
  if (outcome === 'credit') return { cash: 0, credit: round(amount) }
  return { cash: 0, credit: 0 }
}
