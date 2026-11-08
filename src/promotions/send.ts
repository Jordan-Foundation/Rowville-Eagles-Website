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
    p.find({ collection: 'users', where: { roles: { contains: 'parent' } }, limit: BIG, ...q, select: { email: true } }),
    p.find({ collection: 'participants', limit: BIG, ...q, select: { account: true, memberships: true, dateOfBirth: true } }),
    p.find({ collection: 'bookings', where: { status: { equals: 'paid' } }, limit: BIG, ...q, select: { account: true, program: true } }),
    p.find({ collection: 'academy-registrations', where: { status: { equals: 'paid' } }, limit: BIG, ...q, select: { account: true, program: true } }),
    p.find({ collection: 'academy-bookings', where: { status: { in: ['confirmed', 'completed'] } }, limit: BIG, ...q, select: { account: true } }),
    p.find({ collection: 'orders', where: { status: { in: ['paid', 'fulfilled'] } }, limit: BIG, ...q, select: { account: true } }),
    p.find({ collection: 'team-members', where: { active: { equals: true } }, limit: BIG, ...q, select: { account: true, team: true } }),
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
    p.find({ collection: 'programs', where: { type: { not_in: ['community', 'private-session'] } }, sort: '-startDate', limit: 60, ...q, select: { title: true, type: true } }),
    p.find({ collection: 'teams', where: { archived: { not_equals: true } }, sort: 'name', limit: 100, ...q, select: { name: true, event: true, type: true } }),
    p.find({ collection: 'participants', limit: BIG, ...q, select: { dateOfBirth: true } }),
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
    const { docs } = await p.find({ collection, where: { id: { in: list } }, limit: list.length, ...q })
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
  const { docs } = await p.find({ collection: 'users', where: { id: { in: ids } }, limit: ids.length, ...q, select: { marketingEmail: true, marketingSms: true, smsOptOut: true, phone: true } })
  return {
    families: ids.length,
    email: docs.filter((u) => u.marketingEmail === true).length,
    sms: docs.filter((u) => u.marketingSms === true && u.smsOptOut !== true && !!u.phone).length,
    unknown,
    ids,
  }
}

/**
 * Send (now or from the scheduler): the audience gets the discount, and those who agreed to marketing get the
 * email and/or text. Claims the promotion first so it's never sent twice.
 */
export async function sendPromotion(p: Payload, id: number, by: number | null, now = new Date()) {
  const claimed = await p.update({ collection: 'promotions', where: { id: { equals: id }, sentAt: { exists: false } }, data: { sentAt: now.toISOString() }, overrideAccess: true })
  if (!claimed.docs.length) throw new Error('This promotion has already been sent.')
  const d = await p.findByID({ collection: 'promotions', id, ...q })
  const audience = (d.audience ?? { mode: 'picked' }) as Audience
  const { ids } = await audiencePreview(p, audience)
  const recipients = [...new Set([...(d.recipients ?? []).map(idOf).filter((x): x is number => !!x), ...ids])]
  await p.update({ collection: 'promotions', id, overrideAccess: true, data: { recipients, status: d.status === 'ended' ? 'ended' : 'live', approvedBy: by ?? d.approvedBy ?? undefined } })
  const summary = await scopeSummary(p, d)
  const channels = d.channels ?? []
  const email = channels.includes('email') && d.subject
    ? await sendMarketingEmail(p, { userIds: ids, subject: d.subject, brand: d.brand === 'club' ? 'club' : 'academy', blocks: (u) => emailBlocks(d, summary, u) })
    : { sent: 0, skipped: 0 }
  const sms = channels.includes('sms') && d.smsText ? await sendMarketingSms(p, { userIds: ids, body: smsBody(d.smsText, senderName(d)) }) : { sent: 0, skipped: 0 }
  const counts = { families: recipients.length, audience: ids.length, email, sms }
  await p.update({ collection: 'promotions', id, overrideAccess: true, data: { sentCounts: counts } })
  return counts
}

/** Daily job: send promotions scheduled for today or earlier. */
export async function runScheduledPromotions(p: Payload, now = new Date()) {
  const { docs } = await p.find({ collection: 'promotions', where: { status: { equals: 'scheduled' }, scheduledFor: { less_than_equal: now.toISOString() }, sentAt: { exists: false } }, limit: 10, ...q })
  let sent = 0
  for (const d of docs) {
    try {
      await sendPromotion(p, d.id, idOf(d.approvedBy), now)
      sent++
    } catch (e) {
      p.logger.error({ err: e, msg: `Scheduled promotion ${d.id} failed to send` })
    }
  }
  return { sent }
}
