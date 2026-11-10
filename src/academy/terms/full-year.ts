/**
 * Academy full year: one payment for all four terms, at the four term prices less a discount (10%).
 * The family chooses their Term 1 training time(s); Terms 2–4 are placed on the same night and time
 * when that training time exists (and fits and has room), otherwise Management places them.
 * Terms 1 and 4 (per term) are 2 sessions a week; Terms 2 and 3 (per session) are 1 session a week.
 */
import type { Payload } from 'payload'
import type { AcademyTermSlot, Program } from '../../payload-types'
import { slotSessions, slotsForYear, slotLabel, type SlotShape } from './slots'
import { fullTermPrice, fullYearQuote, isPerTerm, perTermQuote, slotCounts, FULL_YEAR_DISCOUNT_DEFAULT } from './pricing'

const q = { overrideAccess: true, depth: 0 } as const
const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null))
const round = (n: number) => Math.round(n * 100) / 100

export type YearData = { year: Program; terms: Program[]; slots: Map<number, AcademyTermSlot[]>; taken: Map<number, number> }

/** The full-year program's four terms (in date order), their training times and places taken. */
export async function loadYear(p: Payload, year: Program): Promise<YearData> {
  const ids = (year.yearPrograms ?? []).map(idOf).filter(Boolean) as number[]
  const { docs } = ids.length ? await p.find({ pagination: false, collection: 'programs', where: { id: { in: ids } }, limit: 4, ...q }) : { docs: [] as Program[] }
  const terms = docs.sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))
  const slots = new Map<number, AcademyTermSlot[]>()
  const taken = new Map<number, number>()
  for (const t of terms) {
    const { docs: s } = await p.find({ pagination: false, collection: 'academy-term-slots', where: { program: { equals: t.id }, active: { not_equals: false } }, limit: 100, sort: 'weekday', ...q })
    slots.set(t.id, s)
    const { docs: regs } = await p.find({ pagination: false, collection: 'academy-registrations', where: { program: { equals: t.id }, status: { in: ['offered', 'pending_payment', 'paid'] }, slot: { exists: true } }, limit: 5000, ...q, select: { slot: true } })
    for (const r of regs) taken.set(idOf(r.slot)!, (taken.get(idOf(r.slot)!) ?? 0) + 1)
  }
  return { year, terms, slots, taken }
}

const hasRoom = (s: AcademyTermSlot, taken: Map<number, number>) => !s.capacity || (taken.get(s.id) ?? 0) < s.capacity

export type TermPlan = { program: Program; price: number; placed: AcademyTermSlot[]; nights: 1 | 2; toPlace: number; label: string }
export type YearPlan = { terms: TermPlan[]; sum: number; total: number; saving: number; pct: number }

/** Price and placements for a player born in `birthYear` choosing these Term 1 training times. */
export function planYear(d: YearData, birthYear: number, term1Slots: AcademyTermSlot[], now = new Date()): YearPlan | null {
  if (d.terms.length !== 4 || !term1Slots.length) return null
  // Week order (Monday first), then time
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  term1Slots = [...term1Slots].sort((a, b) => DAYS.indexOf(a.weekday) - DAYS.indexOf(b.weekday) || a.startTime.localeCompare(b.startTime))
  const plans: TermPlan[] = []
  for (const [i, program] of d.terms.entries()) {
    const nights: 1 | 2 = isPerTerm(program) && term1Slots.length >= 2 ? 2 : 1
    const wanted = term1Slots.slice(0, nights)
    if (i === 0) {
      // Term 1: what joining now costs (pro-rata once it has started)
      const counts = wanted.map((s) => slotCounts(s, program, now))
      const rate = nights === 2 && program.twoNightPricePerSession != null ? program.twoNightPricePerSession : program.pricePerSession
      const price = isPerTerm(program) ? perTermQuote(program, counts).total : round((rate ?? 0) * counts.reduce((n, c) => n + c.left, 0))
      plans.push({ program, price, placed: wanted, nights, toPlace: 0, label: wanted.map(slotLabel).join(' + ') })
      continue
    }
    const fits = slotsForYear(d.slots.get(program.id) ?? [], birthYear)
    const placed: AcademyTermSlot[] = []
    const counts: { all: number }[] = []
    const sameTime = (w: AcademyTermSlot) => fits.find((s) => s.weekday === w.weekday && s.startTime === w.startTime && hasRoom(s, d.taken))
    // One night a week: the first of their Term 1 nights that runs this term
    const want = nights === 1 ? [term1Slots.find((w) => sameTime(w)) ?? term1Slots[0]] : wanted
    for (const w of want) {
      const match = fits.find((s) => s.weekday === w.weekday && s.startTime === w.startTime && hasRoom(s, d.taken) && !placed.includes(s))
      if (match) placed.push(match)
      // Priced on the same night and time across this term, even if Management has to place them
      const shape: SlotShape = match ?? { id: -1, weekday: w.weekday, startTime: w.startTime, endTime: w.endTime }
      counts.push({ all: slotSessions(shape, program).filter((s) => !s.cancelled).length })
    }
    const price = fullTermPrice(program, counts)
    const toPlace = nights - placed.length
    plans.push({ program, price, placed, nights, toPlace, label: placed.length ? placed.map(slotLabel).join(' + ') + (toPlace ? ' (one more time to be confirmed)' : '') : 'Training time to be confirmed' })
  }
  const quote = fullYearQuote(plans.map((t) => t.price), d.year.discountPct ?? FULL_YEAR_DISCOUNT_DEFAULT)
  return { terms: plans, ...quote }
}

export type YearOption = { key: string; slotIds: number[]; birthYear: number; label: string; plan: YearPlan }

/** Every Term 1 choice a family could make, per year of birth (for the booking page). */
export function yearOptions(d: YearData, now = new Date()): YearOption[] {
  const t1 = d.terms[0]
  if (!t1) return []
  const slots = (d.slots.get(t1.id) ?? []).filter((s) => hasRoom(s, d.taken) && slotCounts(s, t1, now).left >= 2)
  const years = [...new Set(slots.flatMap((s) => (s.birthYears ?? []) as number[]))]
  const out: YearOption[] = []
  for (const by of years) {
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    const fits = slots.filter((s) => (s.birthYears ?? []).includes(by)).sort((a, b) => DAYS.indexOf(a.weekday) - DAYS.indexOf(b.weekday) || a.startTime.localeCompare(b.startTime))
    const sets: AcademyTermSlot[][] = isPerTerm(t1) && fits.length >= 2 ? fits.flatMap((a, i) => fits.slice(i + 1).map((b) => [a, b])) : fits.map((s) => [s])
    for (const set of sets) {
      const plan = planYear(d, by, set, now)
      if (plan) out.push({ key: `${by}:${set.map((s) => s.id).join('+')}`, slotIds: set.map((s) => s.id), birthYear: by, label: set.map(slotLabel).join(' + '), plan })
    }
  }
  return out
}

/** A rough full-year price for cards (first age group's first choice). */
export function yearEstimate(d: YearData) {
  const opts = yearOptions(d)
  if (!opts.length) return null
  return opts.reduce((lo, o) => (o.plan.total < lo.plan.total ? o : lo)).plan
}

export class FullYearError extends Error {}

type Contact = { firstName: string; lastName: string; email: string; phone: string }
type Player = { firstName: string; lastName: string; dateOfBirth: string; medical?: string; emergencyName: string; emergencyPhone: string; photoConsent: boolean }

/**
 * Register a player for the full year: a registration for each term's training time(s) (Terms 2–4 left
 * without a time when Management has to place them), all paid by one booking. Returns where to send the family.
 */
export async function checkoutFullYear(p: Payload, o: { year: Program; slotIds: number[]; birthYear: number; contact: Contact; player: Player; accountId?: number; participantId?: number | null; cancelPath: string }) {
  const { confirmPayment, newReference, startCheckout } = await import('../../lib/payments')
  const { feeNote, payeeOf, existingRegistration } = await import('./service')
  const d = await loadYear(p, o.year)
  if (d.terms.length !== 4) throw new FullYearError('The full year isn’t set up yet — please contact us.')
  const t1Slots = (d.slots.get(d.terms[0].id) ?? []).filter((s) => o.slotIds.includes(s.id))
  if (t1Slots.length !== o.slotIds.length || !t1Slots.every((s) => (s.birthYears ?? []).includes(o.birthYear) && hasRoom(s, d.taken))) throw new FullYearError('Sorry, that training time just filled up — please choose another.')
  if (isPerTerm(d.terms[0]) && t1Slots.length < 2 && slotsForYear(d.slots.get(d.terms[0].id) ?? [], o.birthYear).filter((s) => hasRoom(s, d.taken)).length >= 2) throw new FullYearError('Choose two Term 1 training times.')
  const plan = planYear(d, o.birthYear, t1Slots)
  if (!plan) throw new FullYearError('The full year isn’t available for that training time.')
  for (const t of d.terms) {
    const ex = await existingRegistration(p, t.id, o.player)
    if (ex && ex.status !== 'cancelled' && ex.status !== 'pending_payment') throw new FullYearError(`${o.player.firstName} is already registered for ${t.title}.`)
  }
  const payee = payeeOf(o.year)
  const reference = newReference(payee)
  const booking = await p.create({
    collection: 'bookings',
    data: { reference, program: o.year.id, status: 'pending', payee, amount: plan.total, birthYear: o.birthYear, account: o.accountId, participant: o.participantId ?? undefined, contact: o.contact, player: { ...o.player } },
    ...q,
  })
  // Each term's share of the discounted total, split between its nights
  const ratio = plan.sum ? plan.total / plan.sum : 0
  let primary: number | null = null
  for (const t of plan.terms) {
    const termAmount = round(t.price * ratio)
    const rows: (AcademyTermSlot | null)[] = [...t.placed, ...Array.from({ length: t.toPlace }, () => null)]
    const made: number[] = []
    for (const [n, slot] of rows.entries()) {
      const reg = await p.create({
        collection: 'academy-registrations',
        showHiddenFields: true,
        data: {
          program: t.program.id, status: 'pending_payment', slot: slot?.id, contact: o.contact, player: o.player, account: o.accountId, participant: o.participantId ?? undefined,
          nights: String(t.nights) as '1' | '2', amount: n === rows.length - 1 ? round(termAmount - round(termAmount / rows.length) * (rows.length - 1)) : round(termAmount / rows.length),
          booking: booking.id, fullYear: true, notes: slot ? 'Full year' : 'Full year — training time to be confirmed by Management',
        },
        ...q,
      })
      made.push(reg.id)
      primary ??= reg.id
    }
    if (made.length === 2) {
      await p.update({ collection: 'academy-registrations', id: made[0], data: { pairedWith: made[1] }, ...q })
      await p.update({ collection: 'academy-registrations', id: made[1], data: { pairedWith: made[0] }, ...q })
    }
  }
  await p.update({ collection: 'bookings', id: booking.id, data: { academyRegistration: primary! }, ...q })
  const who = `${o.player.firstName} ${o.player.lastName}`
  const note = await feeNote(p)
  if (!plan.total) {
    await confirmPayment(p, 'booking', reference)
    return `/checkout/success?kind=booking&ref=${reference}`
  }
  try {
    const checkout = await startCheckout({
      payee,
      kind: 'booking',
      reference,
      email: o.contact.email,
      items: plan.terms.map((t, i) => ({ name: `${t.program.title}${i === 0 ? '' : ''}`, description: `${who} · ${t.label}${i === 0 ? ` · ${note}` : ''}`, unitAmount: t.price, quantity: 1 })),
      discount: plan.saving > 0 ? { amount: plan.saving, label: `Full year — ${plan.pct}% off` } : null,
      cancelPath: o.cancelPath,
    })
    if (checkout.sessionId) await p.update({ collection: 'bookings', id: booking.id, data: { stripeCheckoutId: checkout.sessionId }, ...q })
    return checkout.url
  } catch (e) {
    await p.update({ collection: 'bookings', id: booking.id, data: { status: 'cancelled' }, ...q })
    await p.update({ collection: 'academy-registrations', where: { booking: { equals: booking.id } }, data: { status: 'cancelled' }, ...q })
    throw e
  }
}
