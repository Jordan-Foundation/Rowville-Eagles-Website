import type { Payload } from 'payload'
import type { Promotion, User } from '@/payload-types'
import { birthYearOf } from '../lib/age-groups'
import { esc, type Block } from '../lib/email-templates'
import { formatDate } from '../lib/format'
import { sendMarketingEmail, sendMarketingSms } from '../lib/marketing'
import { siteUrl } from '../lib/payments'
import { audienceIds, smsBody, type Audience, type Family } from './audience'
import { PROGRAM_GROUPS, discountLabel } from './rules'

const q = { depth: 0, overrideAccess: true } as const
const idOf = (v: unknown): number | null => (v && typeof v === 'object' ? (v as { id: number }).id : typeof v === 'number' ? v : null)
const BIG = 20000

/** Every family account with what we know about them (memberships, what they've bought, players' birth years, teams). */
export async function loadFamilies(p: Payload): Promise<Family[]> {
  const [users, kids, bookings, regs, oneOnOnes, orders, members] = await Promise.all([
    p.find({ pagination: false, collection: 'users', where: { roles: { contains: 'parent' } }, limit: BIG, ...q, select: { email: true } }),
    p.find({ pagination: false, collection: 'participants', limit: BIG, ...q, select: { account: true, memberships: true, dateOfBirth: true } }),
    p.find({ pagination: false, collection: 'bookings', where: { status: { equals: 'paid' } }, limit: BIG, ...q, select: { account: true, program: true } }),
    p.find({ pagination: false, collection: 'academy-registrations', where: { status: { equals: 'paid' } }, limit: BIG, ...q, select: { account: true, program: true } }),
    p.find({ pagination: false, collection: 'academy-bookings', where: { status: { in: ['confirmed', 'completed'] } }, limit: BIG, ...q, select: { account: true } }),
    p.find({ pagination: false, collection: 'orders', where: { status: { in: ['paid', 'ready', 'completed'] } }, limit: BIG, ...q, select: { account: true } }),
    p.find({ pagination: false, collection: 'team-members', where: { active: { equals: true } }, limit: BIG, ...q, select: { account: true, team: true } }),
  ])
  const fams = new Map<number, Family>(users.docs.map((u) => [u.id, { userId: u.id, email: u.email, memberships: new Set(), history: new Set(), birthYears: new Set(), teams: new Set() }]))
  const get = (v: unknown) => { const id = idOf(v); return id ? fams.get(id) : undefined }
  for (const k of kids.docs) { const f = get(k.account); if (!f) continue; (k.memberships ?? []).forEach((m) => f.memberships.add(m)); const y = birthYearOf(k.dateOfBirth); if (y) f.birthYears.add(y) }
  for (const b of [...bookings.docs, ...regs.docs]) { const f = get(b.account); const pid = idOf(b.program); if (f && pid) f.history.add(`program:${pid}`) }
  for (const b of oneOnOnes.docs) get(b.account)?.history.add('1on1')
  for (const o of orders.docs) get(o.account)?.history.add('shop')
  for (const m of members.docs) { const f = get(m.account); const t = idOf(m.team); if (f && t) f.teams.add(t) }
  return [...fams.values()]
}

/** Choices for the audience form. */
export async function audienceOptions(p: Payload) {
  const [programs, teams, kids] = await Promise.all([
    p.find({ pagination: false, collection: 'programs', where: { type: { not_in: ['community', 'private-session'] } }, sort: '-startDate', limit: 60, ...q, select: { title: true, type: true } }),
    p.find({ pagination: false, collection: 'teams', where: { archived: { not_equals: true } }, sort: 'name', limit: 100, ...q, select: { name: true, event: true, type: true } }),
    p.find({ pagination: false, collection: 'participants', limit: BIG, ...q, select: { dateOfBirth: true } }),
  ])
  const years = [...new Set(kids.docs.map((k) => birthYearOf(k.dateOfBirth)).filter((y): y is number => !!y))].sort((a, b) => b - a)
  return {
    history: [{ key: '1on1', label: '1-on-1 sessions' }, { key: 'shop', label: 'Shop orders' }, ...programs.docs.map((x) => ({ key: `program:${x.id}`, label: x.title }))],
    teams: teams.docs.map((t) => ({ id: t.id, label: t.type === 'tournament' && t.event ? `${t.event} – ${t.name}` : t.name })),
    years,
  }
}

/** "Holiday camps, 1-on-1s and Drink Bottle" — what the promotion covers, in words. */
export async function scopeSummary(p: Payload, d: Promotion) {
  if (d.everything) return 'Everything on our website'
  const parts: string[] = []
  for (const g of d.programGroups ?? []) parts.push((PROGRAM_GROUPS.find((x) => x.value === g)?.label ?? g).replace(/^All /, '').replace(/^other programs$/, 'other programs'))
  const names = async (collection: 'programs' | 'products' | 'academy-terms' | 'selection-rounds', ids: unknown, field: string) => {
    const list = (Array.isArray(ids) ? ids : []).map(idOf).filter((x): x is number => !!x)
    if (!list.length) return []
    const { docs } = await p.find({ pagination: false, collection, where: { id: { in: list } }, limit: list.length, ...q })
    return docs.map((x) => String((x as unknown as Record<string, unknown>)[field] ?? ''))
  }
  parts.push(...(await names('programs', d.programs, 'title')))
  if (d.oneOnOneAll) parts.push('1-on-1 sessions')
  else parts.push(...(await names('academy-terms', d.oneOnOneTerms, 'name')).map((n) => `1-on-1s in ${n}`))
  if (d.shopAll) parts.push('everything in our shop')
  else parts.push(...(await names('products', d.products, 'name')))
  if (d.tournamentsAll) parts.push('tournament fees')
  else parts.push(...(await names('selection-rounds', d.tournamentRounds, 'title')).map((n) => `${n} fees`))
  if (d.foundationPlus) parts.push('Foundation+ plans (first payment)')
  const list = parts.filter(Boolean).map((x, i) => (i === 0 ? x.charAt(0).toUpperCase() + x.slice(1) : x))
  return list.length <= 1 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`
}

/** Where the email's button goes if Management didn't choose. */
export function defaultCta(d: Promotion) {
  if (!d.everything) {
    const kinds = [(d.programGroups?.length || d.programs?.length) && 'programs', (d.oneOnOneAll || d.oneOnOneTerms?.length) && '1on1', (d.shopAll || d.products?.length) && 'shop', d.foundationPlus && 'fplus', (d.tournamentsAll || d.tournamentRounds?.length) && 'tour'].filter(Boolean)
    if (kinds.length === 1) return kinds[0] === '1on1' ? '/academy/1-on-1' : kinds[0] === 'shop' ? '/shop' : kinds[0] === 'fplus' ? '/foundation-plus' : kinds[0] === 'tour' ? '/account' : '/programs'
  }
  return '/programs'
}

const validity = (d: Promotion) => [d.startsAt && `from ${formatDate(d.startsAt, { day: 'numeric', month: 'long' })}`, d.endsAt && `until ${formatDate(d.endsAt, { weekday: 'long', day: 'numeric', month: 'long' })}`].filter(Boolean).join(' ')

export function emailBlocks(d: Promotion, summary: string, user: Pick<User, 'firstName' | 'email'>): Block[] {
  const rows: [string, string][] = [['Offer', discountLabel(d)], ['On', summary]]
  if (validity(d)) rows.push(['Valid', validity(d)])
  if (d.usesPerFamily) rows.push(['Uses', d.usesPerFamily === 1 ? 'One booking or order per family' : `${d.usesPerFamily} bookings or orders per family`])
  return [{
    heading: `${esc(d.name)}: ${esc(discountLabel(d))}`,
    intro: `Hi ${esc(user.firstName || 'there')},<br><br>${esc(d.message ?? '').replace(/\n/g, '<br>')}`,
    rows,
    cta: { label: 'Book now', href: `${siteUrl()}${d.ctaPath || defaultCta(d)}` },
    after: `The discount is taken off automatically when you pay — just log in with ${esc(user.email)} first.`,
  }]
}

export const senderName = (d: Pick<Promotion, 'brand'>) => (d.brand === 'club' ? 'Rowville Eagles FC' : 'Foundation Academy')

/** The audience → families (ids), and how many of them can be emailed / texted right now. */
export async function audiencePreview(p: Payload, a: Audience) {
  const families = await loadFamilies(p)
  const { ids, unknown } = audienceIds(a, families)
  if (!ids.length) return { families: 0, email: 0, sms: 0, unknown, ids }
  const { docs } = await p.find({ pagination: false, collection: 'users', where: { id: { in: ids } }, limit: ids.length, ...q, select: { marketingEmail: true, marketingSms: true, smsOptOut: true, phone: true } })
  return {
    families: ids.length,
    email: docs.filter((u) => u.marketingEmail === true).length,
    sms: docs.filter((u) => u.marketingSms === true && u.smsOptOut !== true && !!u.phone).length,
    unknown,
    ids,
  }
}

type Tally = { sent: number; skipped: number; failed: number }
type SendState = { ids: number[]; emailDone: number[]; smsDone: number[]; email: Tally; sms: Tally }
export type SendCounts = { families: number; audience: number; email: Tally; sms: Tally; finished: boolean; remaining: number }
const zero = (): Tally => ({ sent: 0, skipped: 0, failed: 0 })
/** Time one request may spend sending before it stops and leaves the rest for "Continue" / the daily job. */
const BUDGET_MS = 240_000

/**
 * Send (now or from the scheduler): the audience gets the discount straight away, and those who agreed to
 * marketing get the email and/or text. Claims the promotion first so it's never started twice; who has been
 * reached is saved as it goes, so a send that runs out of time carries on later without repeats.
 */
export async function sendPromotion(p: Payload, id: number, by: number | null, now = new Date()): Promise<SendCounts> {
  const claimed = await p.update({ collection: 'promotions', where: { id: { equals: id }, sentAt: { exists: false } }, data: { sentAt: now.toISOString() }, overrideAccess: true, depth: 0 })
  if (!claimed.docs.length) throw new Error('This promotion has already been sent.')
  const d = await p.findByID({ collection: 'promotions', id, ...q })
  const audience = (d.audience ?? { mode: 'picked' }) as Audience
  const { ids } = await audiencePreview(p, audience)
  const recipients = [...new Set([...(d.recipients ?? []).map(idOf).filter((x): x is number => !!x), ...ids])]
  const state: SendState = { ids, emailDone: [], smsDone: [], email: zero(), sms: zero() }
  await p.update({ collection: 'promotions', id, overrideAccess: true, depth: 0, data: { recipients, status: d.status === 'ended' ? 'ended' : 'live', approvedBy: by ?? d.approvedBy ?? undefined, sendState: state } })
  return continuePromotionSend(p, id)
}

/** Carry on sending a promotion's messages from where it stopped. */
export async function continuePromotionSend(p: Payload, id: number, budgetMs = BUDGET_MS): Promise<SendCounts> {
  const deadline = Date.now() + budgetMs
  const d = await p.findByID({ collection: 'promotions', id, ...q })
  const state = { email: zero(), sms: zero(), emailDone: [], smsDone: [], ids: [], ...((d.sendState ?? {}) as Partial<SendState>) } as SendState
  const channels = d.channels ?? []
  const summary = await scopeSummary(p, d)
  const add = (t: Tally, r: { sent: number; skipped: number; failed: number }) => ({ sent: t.sent + r.sent, skipped: t.skipped + r.skipped, failed: t.failed + r.failed })
  const save = () => p.update({ collection: 'promotions', id, overrideAccess: true, depth: 0, data: { sendState: state } })

  let finished = true
  if (channels.includes('email') && d.subject) {
    const left = state.ids.filter((x) => !state.emailDone.includes(x))
    if (left.length) {
      const r = await sendMarketingEmail(p, { userIds: left, subject: d.subject, brand: d.brand === 'club' ? 'club' : 'academy', blocks: (u) => emailBlocks(d, summary, u), deadline })
      state.emailDone.push(...r.done)
      state.email = add(state.email, r)
      finished &&= r.finished
      await save()
    }
  }
  if (finished && channels.includes('sms') && d.smsText) {
    const left = state.ids.filter((x) => !state.smsDone.includes(x))
    if (left.length) {
      const r = await sendMarketingSms(p, { userIds: left, body: smsBody(d.smsText, senderName(d)), deadline })
      state.smsDone.push(...r.done)
      state.sms = add(state.sms, r)
      finished &&= r.finished
      await save()
    }
  }
  const total = state.ids.length * ((channels.includes('email') && d.subject ? 1 : 0) + (channels.includes('sms') && d.smsText ? 1 : 0))
  const handled = (channels.includes('email') && d.subject ? state.emailDone.length : 0) + (channels.includes('sms') && d.smsText ? state.smsDone.length : 0)
  const counts: SendCounts = { families: (d.recipients ?? []).length, audience: state.ids.length, email: state.email, sms: state.sms, finished, remaining: Math.max(0, total - handled) }
  await p.update({ collection: 'promotions', id, overrideAccess: true, depth: 0, data: { sentCounts: counts, ...(finished ? { sendCompletedAt: new Date().toISOString() } : {}) } })
  return counts
}

/** Daily job: send promotions scheduled for today or earlier. */
export async function runScheduledPromotions(p: Payload, now = new Date()) {
  const { docs } = await p.find({ pagination: false, collection: 'promotions', where: { status: { equals: 'scheduled' }, scheduledFor: { less_than_equal: now.toISOString() }, sentAt: { exists: false } }, limit: 10, ...q })
  let sent = 0
  for (const d of docs) {
    try {
      await sendPromotion(p, d.id, idOf(d.approvedBy), now)
      sent++
    } catch (e) {
      p.logger.error({ err: e, msg: `Scheduled promotion ${d.id} failed to send` })
    }
  }
  // Sends that ran out of time earlier carry on here
  const { docs: unfinished } = await p.find({ pagination: false, collection: 'promotions', where: { sentAt: { exists: true }, sendCompletedAt: { exists: false } }, limit: 10, ...q, select: { name: true } })
  let continued = 0
  for (const d of unfinished) {
    try {
      await continuePromotionSend(p, d.id, 120_000)
      continued++
    } catch (e) {
      p.logger.error({ err: e, msg: `Promotion ${d.id} could not continue sending` })
    }
  }
  return { sent, continued }
}
