import type { Payload } from 'payload'
import type { AcademyTerm, Program, YearSetup } from '../payload-types'
import { localToUtc, localYmd } from '../lib/time'
import { emailLayout } from '../lib/email-templates'
import { sendEmail } from '../lib/email'
import { siteUrl } from '../lib/payments'
import { DEADLINE_TIME, HOLIDAY_ORDER, defaultDeadline, holidaysFor, setupDue, termProblems, type HolidayPeriod, type Range } from './yearly'

const q = { overrideAccess: true, depth: 0 } as const
const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null))
export class SetupError extends Error {}

export async function loadSetup(p: Payload, year: number) {
  return (await p.find({ pagination: false, collection: 'year-setups', where: { year: { equals: year } }, limit: 1, ...q })).docs[0] ?? null
}

async function timeframe(p: Payload, year: number, period: string) {
  return (await p.find({ pagination: false, collection: 'academy-terms', where: { year: { equals: year }, period: { equals: period } }, limit: 1, ...q })).docs[0] ?? null
}

/** Step 1: the four terms → a draft with the holidays and availability deadlines worked out (all editable). */
export async function startSetup(p: Payload, year: number, terms: Range[]) {
  const problems = termProblems(year, terms)
  if (problems.length) throw new SetupError(problems.join(' '))
  const lastT4 = await timeframe(p, year - 1, 'term-4')
  const holidays = holidaysFor(terms, lastT4 ? localYmd(new Date(lastT4.endDate)) : null)
  const data = {
    year,
    status: 'draft' as const,
    terms: terms.map((t) => ({ ...t, deadline: defaultDeadline(t.start) })),
    holidays: holidays.map((h) => ({ ...h, deadline: defaultDeadline(h.start) })),
  }
  const existing = await loadSetup(p, year)
  if (existing?.status === 'published') throw new SetupError(`${year} is already published — change dates on Set dates.`)
  return existing ? p.update({ collection: 'year-setups', id: existing.id, data, ...q }) : p.create({ collection: 'year-setups', data, ...q })
}

/** Step 2: Management's edits to the dates, deadlines and opening time. */
export async function saveSetup(p: Payload, year: number, o: { terms: (Range & { deadline: string })[]; holidays: (Range & { deadline: string; period: HolidayPeriod })[]; term1OpensAt: string | null }) {
  const problems = termProblems(year, o.terms)
  for (const h of o.holidays) if (!h.start || !h.end || h.end < h.start) problems.push(`${HOLIDAY_ORDER.find((x) => x.period === h.period)?.label}: check the dates.`)
  for (const x of [...o.terms, ...o.holidays]) if (!/^\d{4}-\d{2}-\d{2}$/.test(x.deadline) || x.deadline > x.start) problems.push('Each availability deadline must be on or before the first day.')
  if (problems.length) throw new SetupError([...new Set(problems)].join(' '))
  const existing = await loadSetup(p, year)
  if (!existing) throw new SetupError('Enter the term dates first.')
  if (existing.status === 'published') throw new SetupError(`${year} is already published.`)
  return p.update({ collection: 'year-setups', id: existing.id, data: { terms: o.terms, holidays: o.holidays, term1OpensAt: o.term1OpensAt ?? undefined }, ...q })
}

const termName = (n: number, year: number) => `Term ${n} ${year}`
const holidayName = (period: HolidayPeriod, year: number) => (period === 'summer' ? `Summer holidays ${year - 1}/${String(year).slice(2)}` : `${HOLIDAY_ORDER.find((h) => h.period === period)!.label} ${year}`)

export type PlanItem = { kind: 'timeframe' | 'program'; name: string; action: 'create' | 'update' | 'keep'; detail: string }

/** What publishing will do (shown on the summary before publishing). */
export async function publishPlan(p: Payload, setup: YearSetup): Promise<PlanItem[]> {
  const items: PlanItem[] = []
  const fmt = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  for (const [i, t] of (setup.terms ?? []).entries()) {
    const tf = await timeframe(p, setup.year, `term-${i + 1}`)
    items.push({ kind: 'timeframe', name: termName(i + 1, setup.year), action: tf ? 'update' : 'create', detail: `${fmt(t.start!)} – ${fmt(t.end!)} · availability due ${fmt(t.deadline!)}` })
  }
  for (const h of setup.holidays ?? []) {
    const tf = await timeframe(p, setup.year, h.period!)
    items.push({ kind: 'timeframe', name: holidayName(h.period as HolidayPeriod, setup.year), action: tf ? 'update' : 'create', detail: `${fmt(h.start!)} – ${fmt(h.end!)} · availability due ${fmt(h.deadline!)}` })
  }
  for (let n = 1; n <= 4; n++) {
    const tf = await timeframe(p, setup.year, `term-${n}`)
    const existing = tf ? (await p.find({ pagination: false, collection: 'programs', where: { academyTerm: { equals: tf.id }, type: { equals: 'academy-term' } }, limit: 1, ...q })).docs[0] : null
    if (existing) { items.push({ kind: 'program', name: existing.title, action: 'keep', detail: 'Already set up for this term' }); continue }
    const prev = await previousProgram(p, setup.year - 1, n)
    const slots = prev ? (await p.count({ collection: 'academy-term-slots', where: { program: { equals: prev.id } }, overrideAccess: true })).totalDocs : 0
    items.push({ kind: 'program', name: `Academy Term ${n} ${setup.year}`, action: 'create', detail: prev ? `Draft, copying ${slots} training time${slots === 1 ? '' : 's'} from ${prev.title}` : 'Draft — add its training times' })
  }
  return items
}

async function previousProgram(p: Payload, year: number, n: number) {
  const tf = await timeframe(p, year, `term-${n}`)
  if (!tf) return null
  return (await p.find({ pagination: false, collection: 'programs', where: { academyTerm: { equals: tf.id }, type: { equals: 'academy-term' } }, limit: 1, ...q })).docs[0] ?? null
}

async function uniqueSlug(p: Payload, base: string) {
  for (let i = 1; i < 20; i++) {
    const slug = i === 1 ? base : `${base}-${i}`
    if (!(await p.count({ collection: 'programs', where: { slug: { equals: slug } }, overrideAccess: true })).totalDocs) return slug
  }
  return `${base}-${Date.now()}`
}

/** Pricing and rules carry over from last year's matching timeframe. */
function carryOver(prev: AcademyTerm | null) {
  if (!prev) return {}
  const { pricePerSession, casualPrice, termMemberPrice, termMemberWindowDays, sessionMinutes, slotStartTimes, weekendStartTimes, bookingCutoffHours, minTermSessions, holdMinutes, shareLinkHoldHours, accountReminderDays, location, packSizes, packPricePerSession } = prev
  return { pricePerSession, casualPrice, termMemberPrice, termMemberWindowDays, sessionMinutes, slotStartTimes: slotStartTimes?.map((t) => ({ time: t.time })), weekendStartTimes: weekendStartTimes?.map((t) => ({ time: t.time })), bookingCutoffHours, minTermSessions, holdMinutes, shareLinkHoldHours, accountReminderDays, location, packSizes, packPricePerSession }
}

/** Publish: create or update the eight timeframes and the four term programs (as drafts). Safe to run again. */
export async function publishSetup(p: Payload, year: number, actorId?: number | null) {
  const setup = await loadSetup(p, year)
  if (!setup?.terms?.length || !setup.holidays?.length) throw new SetupError('Enter and check the dates first.')
  if (setup.status === 'published') throw new SetupError(`${year} is already published.`)
  const results: { timeframes: { id: number; name: string; action: string }[]; programs: { id: number; title: string; action: string; slots: number }[] } = { timeframes: [], programs: [] }
  const rows: { period: string; name: string; start: string; end: string; deadline: string }[] = [
    ...setup.terms.map((t, i) => ({ period: `term-${i + 1}`, name: termName(i + 1, year), start: t.start!, end: t.end!, deadline: t.deadline! })),
    ...setup.holidays.map((h) => ({ period: h.period!, name: holidayName(h.period as HolidayPeriod, year), start: h.start!, end: h.end!, deadline: h.deadline! })),
  ]
  const termIds: Record<number, number> = {}
  for (const r of rows) {
    const existing = await timeframe(p, year, r.period)
    const prev = await timeframe(p, year - 1, r.period)
    const data = { name: r.name, period: r.period as AcademyTerm['period'], startDate: r.start, endDate: r.end, availabilityDeadline: localToUtc(r.deadline, DEADLINE_TIME).toISOString() }
    const doc = existing
      ? await p.update({ collection: 'academy-terms', id: existing.id, data: { ...data, ...(existing.status === 'draft' ? { status: 'availability' as const } : {}) }, ...q })
      : await p.create({ collection: 'academy-terms', data: { ...carryOver(prev), ...data, status: 'availability' } as never, ...q })
    results.timeframes.push({ id: doc.id, name: doc.name, action: existing ? 'updated' : 'created' })
    if (r.period.startsWith('term-')) termIds[Number(r.period.slice(5))] = doc.id
  }
  for (let n = 1; n <= 4; n++) {
    const tfId = termIds[n]
    const existing = (await p.find({ pagination: false, collection: 'programs', where: { academyTerm: { equals: tfId }, type: { equals: 'academy-term' } }, limit: 1, ...q })).docs[0]
    if (existing) { results.programs.push({ id: existing.id, title: existing.title, action: 'kept', slots: 0 }); continue }
    const prev = await previousProgram(p, year - 1, n)
    const copy = prev ? pickProgram(prev) : {}
    const program = await p.create({
      collection: 'programs',
      data: {
        brand: 'academy',
        summary: 'Weekly Foundation Academy training in small groups, with an individual development plan and end-of-term review.',
        ...copy,
        title: `Academy Term ${n} ${year}`,
        slug: await uniqueSlug(p, `academy-term-${n}-${year}`),
        type: 'academy-term',
        status: 'draft',
        academyTerm: tfId,
      } as never,
      ...q,
    })
    let slots = 0
    if (prev) {
      const { docs } = await p.find({ pagination: false, collection: 'academy-term-slots', where: { program: { equals: prev.id } }, limit: 100, ...q })
      for (const s of docs) {
        await p.create({
          collection: 'academy-term-slots',
          data: {
            program: program.id, weekday: s.weekday, startTime: s.startTime, endTime: s.endTime, venue: s.venue, birthYears: (s.birthYears ?? []).map((y) => y + 1),
            capacity: s.capacity, active: s.active, coaches: (s.coaches ?? []).map(idOf).filter(Boolean) as number[],
            groups: (s.groups ?? []).map((g) => ({ name: g.name, coaches: (g.coaches ?? []).map(idOf).filter(Boolean) as number[] })),
          } as never,
          ...q,
        })
        slots++
      }
    }
    results.programs.push({ id: program.id, title: program.title, action: 'created', slots })
  }
  await p.update({ collection: 'year-setups', id: setup.id, data: { status: 'published', publishedAt: new Date().toISOString(), publishedBy: actorId ?? undefined, results }, ...q })
  return results
}

function pickProgram(prev: Program) {
  const { brand, summary, description, ageRange, scheduleNote, location, capacity, minAge, maxAge, pricePerSession, twoNightPricePerSession, trialPrice, whatToBring, dropOffPickUp, priceNote, payee, visibility } = prev as Program & { trialPrice?: number | null }
  return { brand, summary, description, ageRange, scheduleNote, location, capacity, minAge, maxAge, pricePerSession, twoNightPricePerSession, trialPrice, whatToBring, dropOffPickUp, priceNote, payee, visibility }
}

/** Years already published. */
export async function publishedYears(p: Payload) {
  const { docs } = await p.find({ pagination: false, collection: 'year-setups', where: { status: { equals: 'published' } }, limit: 50, ...q, select: { year: true } })
  return docs.map((d) => d.year)
}

/** Daily from 1 November: once, email Management that next year's setup is due. */
export async function yearlyReminder(p: Payload, now = new Date()) {
  const due = setupDue(now, await publishedYears(p))
  if (!due) return { sent: 0 }
  const existing = await loadSetup(p, due)
  if (existing?.reminderSentAt) return { sent: 0 }
  const row = existing ?? (await p.create({ collection: 'year-setups', data: { year: due, status: 'draft' }, ...q }))
  await p.update({ collection: 'year-setups', id: row.id, data: { reminderSentAt: now.toISOString() }, ...q })
  const { docs: people } = await p.find({ pagination: false, collection: 'users', where: { roles: { in: ['admin', 'committee'] } }, limit: 50, ...q })
  const html = emailLayout('academy', [{
    heading: `Time to set up ${due}`,
    intro: `It’s November — please enter the ${due} school term dates. The school holidays, coach availability deadlines and Academy term programs are worked out from them, and you’ll see a summary before anything is published.`,
    cta: { label: `Set up ${due}`, href: `${siteUrl()}/management/yearly-setup?year=${due}` },
  }])
  for (const u of people) await sendEmail(p, { to: u.email, subject: `Set up ${due}: enter next year’s term dates`, html, sender: 'academy', userId: u.id })
  return { sent: people.length }
}
