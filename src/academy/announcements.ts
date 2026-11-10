import type { Payload } from 'payload'
import type { Announcement, Program, User } from '../payload-types'
import { esc, type Block } from '../lib/email-templates'
import { formatAUD, formatDate } from '../lib/format'
import { localYmd } from '../lib/time'
import { sendMarketingEmail, sendMarketingSms } from '../lib/marketing'
import { siteUrl } from '../lib/payments'
import { smsBody } from '../promotions/audience'
import { clubFeeNote, isPerTerm } from './terms/pricing'

const q = { overrideAccess: true, depth: 0 } as const
const idOf = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null))
const SENDER = 'Foundation Academy'
const REMINDER_DAYS = 7
const BUDGET_MS = 240_000

type Tally = { sent: number; skipped: number; failed: number }
type SendState = { ids: number[]; emailDone: number[]; smsDone: number[]; email: Tally; sms: Tally }
const zero = (): Tally => ({ sent: 0, skipped: 0, failed: 0 })

const yearOf = (p: Pick<Program, 'startDate'>) => (p.startDate ? Number(localYmd(new Date(p.startDate)).slice(0, 4)) : new Date().getFullYear())

/** "$400 for the term (2 sessions a week)" / "$25 a session (2 nights a week: $20 a session)" */
export function priceLine(p: Program) {
  if (isPerTerm(p)) return `${formatAUD(p.termPrice ?? 400)} for the term (2 sessions a week), pro-rata if you join late`
  if (p.pricePerSession != null) return `${formatAUD(p.pricePerSession)} a session${p.twoNightPricePerSession != null ? ` (2 nights a week: ${formatAUD(p.twoNightPricePerSession)} a session)` : ''}`
  return formatAUD(p.price ?? 0)
}

/** The full-year program that includes this term and is open, if any. */
async function fullYearFor(p: Payload, program: Program) {
  const { docs } = await p.find({ pagination: false, collection: 'programs', where: { type: { equals: 'academy-year' }, status: { in: ['open', 'draft'] }, yearPrograms: { in: [program.id] } }, limit: 1, ...q })
  return docs[0] ?? null
}

async function feeNoteText(p: Payload) {
  const s = await p.findGlobal({ slug: 'academy-settings', ...q }).catch(() => null)
  return clubFeeNote(s?.clubRegistrationFee)
}

/** Ready-to-edit wording for a program's "registrations are open" message (or the reminder). */
export async function draftContent(p: Payload, program: Program, kind: 'open' | 'reminder') {
  const fy = await fullYearFor(p, program)
  const starts = program.startDate ? formatDate(program.startDate, { weekday: 'long', day: 'numeric', month: 'long' }) : 'soon'
  const subject = kind === 'open' ? `Registrations are open: ${program.title}` : `Reminder: ${program.title} registrations are open`
  const message = [
    kind === 'open' ? `Registrations for ${program.title} are now open.` : `${program.title} starts ${starts} and places are filling — there’s still time to register.`,
    `Training starts ${starts}. ${priceLine(program)}.`,
    fy ? `Or book the full year — all four terms in one payment — and save ${fy.discountPct ?? 10}%.` : '',
  ].filter(Boolean).join('\n\n')
  const smsText = `${program.title} registrations are ${kind === 'open' ? 'open' : 'still open'}: ${priceLine(program).split(',')[0]}. Register at ${siteUrl()}/programs/${program.slug}`
  return { subject, message, smsText, fullYearSlug: fy?.slug ?? null }
}

/** The email as families see it (also used for the preview). */
export async function emailBlocks(p: Payload, a: Pick<Announcement, 'subject' | 'message'>, program: Program, user?: Pick<User, 'firstName'>): Promise<Block[]> {
  const fy = await fullYearFor(p, program)
  const note = await feeNoteText(p)
  return [{
    heading: a.subject,
    intro: `${user?.firstName ? `Hi ${esc(user.firstName)} — ` : ''}${esc(a.message).replace(/\n\n/g, '<br><br>')}`,
    rows: [
      ['Program', program.title],
      ['Starts', program.startDate ? formatDate(program.startDate, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—'],
      ['Price', priceLine(program)],
      ...(fy ? ([['Full year', `${fy.title} — save ${fy.discountPct ?? 10}%`]] as [string, string][]) : []),
    ],
    cta: { label: 'Register now', href: `${siteUrl()}/programs/${program.slug}` },
    after: note,
  }]
}

/**
 * A program has opened: create its announcement. The first one each year waits for Management's
 * approval (with a preview); after that they go straight away. Returns null if it already has one.
 */
export async function announceOpening(p: Payload, programId: number, now = new Date()) {
  const program = await p.findByID({ collection: 'programs', id: programId, ...q })
  if (program.type !== 'academy-term') return null
  const { totalDocs } = await p.count({ collection: 'announcements', where: { program: { equals: programId }, kind: { equals: 'open' } }, overrideAccess: true })
  if (totalDocs) return null
  const year = yearOf(program)
  const approvedThisYear = (await p.count({ collection: 'announcements', where: { year: { equals: year }, kind: { equals: 'open' }, status: { in: ['scheduled', 'sending', 'sent'] } }, overrideAccess: true })).totalDocs > 0
  const c = await draftContent(p, program, 'open')
  return p.create({ collection: 'announcements', data: { program: programId, kind: 'open', year, status: approvedThisYear ? 'scheduled' : 'needs-approval', subject: c.subject, message: c.message, smsText: c.smsText, scheduledFor: now.toISOString() }, ...q })
}

/** Families who've registered (or are paying) for this program — the reminder skips them. */
async function registeredAccounts(p: Payload, programId: number) {
  const { docs } = await p.find({ pagination: false, collection: 'academy-registrations', where: { program: { equals: programId }, status: { in: ['offered', 'pending_payment', 'paid'] } }, limit: 20000, ...q, select: { account: true, contact: true } })
  return { ids: new Set(docs.map((r) => idOf(r.account)).filter(Boolean) as number[]), emails: new Set(docs.map((r) => r.contact?.email?.toLowerCase()).filter(Boolean) as string[]) }
}

/** Every family opted in to marketing (consent is checked again for each one as it sends). */
export async function announcementAudience(p: Payload, a: Pick<Announcement, 'kind' | 'program'>) {
  const { docs } = await p.find({ pagination: false, collection: 'users', where: { roles: { contains: 'parent' }, or: [{ marketingEmail: { equals: true } }, { marketingSms: { equals: true } }] }, limit: 20000, ...q, select: { email: true, marketingEmail: true, marketingSms: true, smsOptOut: true, phone: true } })
  let users = docs
  if (a.kind === 'reminder') {
    const reg = await registeredAccounts(p, idOf(a.program)!)
    users = users.filter((u) => !reg.ids.has(u.id) && !reg.emails.has(u.email.toLowerCase()))
  }
  return {
    ids: users.map((u) => u.id),
    email: users.filter((u) => u.marketingEmail === true).length,
    sms: users.filter((u) => u.marketingSms === true && u.smsOptOut !== true && !!u.phone).length,
  }
}

/** Approve (and send now). */
export async function approveAnnouncement(p: Payload, id: number, by: number, edits?: { subject?: string; message?: string; smsText?: string }) {
  const a = await p.findByID({ collection: 'announcements', id, ...q })
  if (a.status !== 'needs-approval') throw new Error('This announcement has already been dealt with.')
  await p.update({ collection: 'announcements', id, data: { ...edits, status: 'scheduled', approvedBy: by, scheduledFor: new Date().toISOString() }, ...q })
  return sendAnnouncement(p, id)
}

/** Start sending: claim it, fix the audience, then send (carries on later if it runs out of time). */
export async function sendAnnouncement(p: Payload, id: number) {
  const claimed = await p.update({ collection: 'announcements', where: { id: { equals: id }, status: { equals: 'scheduled' } }, data: { status: 'sending', sentAt: new Date().toISOString() }, ...q })
  if (!claimed.docs.length) return null
  const a = claimed.docs[0]
  const { ids } = await announcementAudience(p, a)
  await p.update({ collection: 'announcements', id, data: { sendState: { ids, emailDone: [], smsDone: [], email: zero(), sms: zero() } satisfies SendState }, ...q })
  return continueAnnouncement(p, id)
}

export async function continueAnnouncement(p: Payload, id: number, budgetMs = BUDGET_MS) {
  const deadline = Date.now() + budgetMs
  const a = await p.findByID({ collection: 'announcements', id, ...q })
  const program = await p.findByID({ collection: 'programs', id: idOf(a.program)!, ...q })
  const state = { email: zero(), sms: zero(), emailDone: [], smsDone: [], ids: [], ...((a.sendState ?? {}) as Partial<SendState>) } as SendState
  const add = (t: Tally, r: Tally) => ({ sent: t.sent + r.sent, skipped: t.skipped + r.skipped, failed: t.failed + r.failed })
  const blocks = await emailBlocks(p, a, program)
  let finished = true
  const leftEmail = state.ids.filter((x) => !state.emailDone.includes(x))
  if (leftEmail.length) {
    const r = await sendMarketingEmail(p, { userIds: leftEmail, subject: a.subject, brand: 'academy', blocks: (u) => blocks.map((b, i) => (i === 0 ? { ...b, intro: `${u.firstName ? `Hi ${esc(u.firstName)} — ` : ''}${esc(a.message).replace(/\n\n/g, '<br><br>')}` } : b)), deadline })
    state.emailDone.push(...r.done)
    state.email = add(state.email, r)
    finished &&= r.finished
  }
  if (finished && a.smsText) {
    const leftSms = state.ids.filter((x) => !state.smsDone.includes(x))
    if (leftSms.length) {
      const r = await sendMarketingSms(p, { userIds: leftSms, body: smsBody(a.smsText, SENDER), deadline })
      state.smsDone.push(...r.done)
      state.sms = add(state.sms, r)
      finished &&= r.finished
    }
  }
  const counts = { audience: state.ids.length, email: state.email, sms: state.sms, finished }
  const done = finished ? { status: 'sent' as const, sendCompletedAt: new Date().toISOString() } : {}
  await p.update({ collection: 'announcements', id, data: { sendState: state, sentCounts: counts, ...done }, ...q })
  // A week later: remind the opted-in families who still haven't registered
  if (finished && a.kind === 'open') {
    const c = await draftContent(p, program, 'reminder')
    await p.create({ collection: 'announcements', data: { program: program.id, kind: 'reminder', year: a.year, status: 'scheduled', subject: c.subject, message: c.message, smsText: c.smsText, scheduledFor: new Date(Date.now() + REMINDER_DAYS * 86_400_000).toISOString() }, ...q })
  }
  return counts
}

/** Scheduled job + page views: send what's due, carry on unfinished sends. */
export async function runAnnouncements(p: Payload, now = new Date()) {
  const { docs: due } = await p.find({ pagination: false, collection: 'announcements', where: { status: { equals: 'scheduled' }, scheduledFor: { less_than_equal: now.toISOString() } }, limit: 10, ...q })
  for (const a of due) await sendAnnouncement(p, a.id).catch((e) => p.logger.error({ err: e, msg: `Announcement ${a.id} failed` }))
  const { docs: going } = await p.find({ pagination: false, collection: 'announcements', where: { status: { equals: 'sending' } }, limit: 10, ...q })
  for (const a of going) await continueAnnouncement(p, a.id, 120_000).catch((e) => p.logger.error({ err: e, msg: `Announcement ${a.id} could not continue` }))
  return { sent: due.length, continued: going.length }
}
