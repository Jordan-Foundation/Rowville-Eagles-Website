import type { Payload, PayloadRequest } from 'payload'
import type { StaffFeed, User } from '@/payload-types'
import { sendEmail } from '../lib/email'
import { emailLayout, esc } from '../lib/email-templates'
import { siteUrl } from '../lib/payments'
import { sendSms, toE164 } from '../lib/sms'
import { localYmd, TZ } from '../lib/time'
import { digestDue, groupForDigest, isQuiet, morningText, urgentText, type FeedItem } from './rules'

const q = { overrideAccess: true, depth: 0 } as const

export const localHour = (at = new Date()) => Number(new Intl.DateTimeFormat('en-AU', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(at))
const abs = (href?: string | null) => (href ? (href.startsWith('http') ? href : `${siteUrl()}${href}`) : `${siteUrl()}/management/notifications`)

/** The mobiles in Admin → Site settings → “Text alerts for new messages”. */
export async function alertNumbers(p: Payload) {
  const s = await p.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }).catch(() => null)
  return [...new Set(String(s?.smsAlertNumbers ?? '').split(',').map((x) => toE164(x)).filter(Boolean) as string[])]
}

/** Who gets the digest: the emails set in Site settings, else the Management people whose mobile is on the alert list, else every admin. */
export async function digestRecipients(p: Payload): Promise<string[]> {
  const s = await p.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true }).catch(() => null)
  const set = String((s as { alertEmails?: string | null } | null)?.alertEmails ?? '').split(',').map((x) => x.trim().toLowerCase()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x))
  if (set.length) return [...new Set(set)]
  const { docs } = await p.find({ collection: 'users', where: { roles: { in: ['admin', 'committee'] } }, limit: 100, pagination: false, ...q })
  const numbers = await alertNumbers(p)
  const matched = docs.filter((u: User) => u.email && numbers.includes(toE164(u.phone) ?? ''))
  const list = matched.length ? matched : docs.filter((u: User) => u.roles?.includes('admin'))
  return [...new Set(list.map((u) => u.email).filter(Boolean))]
}

async function textAll(p: Payload, body: string) {
  let ok = 0
  for (const to of await alertNumbers(p)) if ((await sendSms(p, { to, body, kind: 'coach_alert' })).sent) ok++
  return ok
}

/**
 * Records one event (once — `key` stops repeats). Urgent ones are texted now, or held for the 7am text overnight.
 * Never throws: a notification problem must not break a booking or payment.
 */
export async function record(p: Payload, key: string, item: FeedItem, req?: PayloadRequest) {
  try {
    const exists = await p.count({ collection: 'staff-feed', where: { sourceKey: { equals: key } }, ...q, req })
    if (exists.totalDocs) return null
    const quiet = isQuiet(localHour())
    const doc = await p.create({
      collection: 'staff-feed',
      data: { kind: item.kind, title: item.title.slice(0, 200), detail: item.detail?.slice(0, 300) ?? null, href: item.href ?? null, urgent: Boolean(item.urgent), sourceKey: key, textStatus: item.urgent ? (quiet ? 'held' : 'none') : 'none' },
      ...q,
      req,
    })
    if (item.urgent && !quiet) {
      const sent = await textAll(p, urgentText(item, abs(item.href)))
      await p.update({ collection: 'staff-feed', id: doc.id, data: { textStatus: sent ? 'sent' : 'failed' }, ...q, req })
    }
    return doc
  } catch (e) {
    p.logger.error({ err: e, msg: `Staff notification failed (${key})` })
    return null
  }
}

/** Hourly: the 7am bundle of anything held overnight, and the 8pm digest email. */
export async function runStaffAlerts(p: Payload, now = new Date()) {
  const hour = localHour(now)
  const out = { morning: 0, digest: 0 }
  if (!isQuiet(hour)) {
    const { docs: held } = await p.find({ collection: 'staff-feed', where: { textStatus: { equals: 'held' } }, sort: 'createdAt', limit: 100, pagination: false, ...q })
    if (held.length) {
      const sent = await textAll(p, morningText(held, `${siteUrl()}/management/notifications`))
      for (const h of held) await p.update({ collection: 'staff-feed', id: h.id, data: { textStatus: sent ? 'sent' : 'failed' }, ...q })
      out.morning = held.length
    }
  }
  const { docs: last } = await p.find({ collection: 'staff-feed', where: { digestedAt: { exists: true } }, sort: '-digestedAt', limit: 1, ...q })
  if (digestDue(hour, localYmd(now), last[0]?.digestedAt ? localYmd(new Date(last[0].digestedAt)) : null)) out.digest = await sendDigest(p, now)
  return out
}

/** Everything not yet in a digest, grouped; skipped on a day with nothing new. */
export async function sendDigest(p: Payload, now = new Date(), opts: { only?: string[]; mark?: boolean } = {}) {
  const { docs } = await p.find({ collection: 'staff-feed', where: { digestedAt: { exists: false } }, sort: 'createdAt', limit: 500, pagination: false, ...q })
  if (!docs.length) return 0
  const to = opts.only ?? (await digestRecipients(p))
  const groups = groupForDigest(docs as (StaffFeed & FeedItem)[])
  const when = (iso: string) => new Intl.DateTimeFormat('en-AU', { timeZone: TZ, weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
  const blocks = groups.map((g) => ({
    heading: `${g.title} (${g.items.length})`,
    intro: g.items.map((i) => `<a href="${esc(abs(i.href))}">${esc(i.title)}</a>${i.detail ? ` — ${esc(i.detail)}` : ''} <span style="color:#5b6577">· ${when(i.createdAt)}${i.urgent ? (i.textStatus === 'sent' ? ' · texted' : '') : ''}</span>`).join('<br>'),
  }))
  const counts = groups.map((g) => `${g.items.length} ${g.title.toLowerCase()}`).join(', ')
  for (const email of to) {
    await sendEmail(p, {
      to: email,
      sender: 'club',
      kind: 'service',
      subject: `Today on the website: ${counts}`,
      html: emailLayout('club', [{ heading: 'Daily summary', intro: `Everything that happened on the website since the last summary (${docs.length} item${docs.length === 1 ? '' : 's'}).`, cta: { label: 'Open Management', href: `${siteUrl()}/management/notifications` } }, ...blocks]),
    })
  }
  if (opts.mark !== false) for (const d of docs) await p.update({ collection: 'staff-feed', id: d.id, data: { digestedAt: now.toISOString() }, ...q })
  return docs.length
}
