import { randomBytes } from 'crypto'
import type { Payload } from 'payload'
import type { PortalLaunch, User } from '@/payload-types'
import { clubBrand } from '../academy/brand'
import { emailLayout } from '../lib/email-templates'
import { sendEmail } from '../lib/email'
import { siteUrl } from '../lib/payments'
import { sendSms, toE164 } from '../lib/sms'
import { createInvite } from '../lib/invites'
import { localToUtc, localYmd } from '../lib/time'
import { makeUnsubscribeToken } from '../lib/unsubscribe-token'
import { DEFAULT_COPY, fillText, followUpDue, numbersList, playerNames, toEmailHtml, toGsm, type MergeVars } from './render'

/**
 * Portal launch (server): the launch email + text to imported families, one reminder, and the 1-on-1 follow-up.
 * One email per parent (siblings together), one text per unique mobile. Each parent's button is their own
 * activation link (or a sign-in link once they've set up their account).
 */

const q = { overrideAccess: true } as const
const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : ((v as number | null | undefined) ?? null))
const DAY = 86_400_000

export type Filter = { mode?: 'all' | 'not_activated'; team?: number | null; rfa?: boolean; batch?: number | null }

export async function launchSettings(p: Payload) {
  const g = (await p.findGlobal({ slug: 'portal-launch', depth: 0, ...q })) as PortalLaunch
  return {
    ...g,
    launchSubject: g.launchSubject || DEFAULT_COPY.launchSubject,
    launchBody: g.launchBody || DEFAULT_COPY.launchBody,
    launchSms: g.launchSms || DEFAULT_COPY.launchSms,
    followUpSubject: g.followUpSubject || DEFAULT_COPY.followUpSubject,
    followUpBody: g.followUpBody || DEFAULT_COPY.followUpBody,
    reminderEnabled: g.reminderEnabled !== false,
    reminderDays: g.reminderDays ?? 5,
    followUpDays: g.followUpDays ?? 7,
  }
}
type Settings = Awaited<ReturnType<typeof launchSettings>>

const familyId = (u: Pick<User, 'id' | 'familyAccount'>) => rel(u.familyAccount) ?? u.id

/** Each family's children, numbers and teams. */
export async function familyKids(p: Payload, familyIds: number[]) {
  const out = new Map<number, { name: string; number: number | null; team: string | null; teamId: number | null; rfa: boolean }[]>()
  if (!familyIds.length) return out
  const { docs: kids } = await p.find({ collection: 'participants', where: { account: { in: familyIds }, status: { not_equals: 'inactive' } }, sort: 'dateOfBirth', limit: 10000, depth: 1, ...q, pagination: false })
  const { numbersFor } = await import('../numbers/service')
  const nums = await numbersFor(p, kids.map((k) => k.id))
  for (const k of kids) {
    const team = typeof k.team === 'object' && k.team ? k.team : null
    const row = { name: k.firstName, number: nums.get(k.id) ?? (k.football?.position === 'Goalkeeper' ? 1 : null), team: team?.name ?? null, teamId: team?.id ?? null, rfa: (k.memberships ?? []).includes('rfa') }
    const a = rel(k.account)!
    out.set(a, [...(out.get(a) ?? []), row])
  }
  return out
}

/** Imported parents who get launch messages, filtered. */
export async function recipients(p: Payload, f: Filter = {}) {
  const { docs } = await p.find({ collection: 'users', where: { 'imported.batch': { exists: true }, 'imported.getsMessages': { equals: true }, ...(f.batch ? { 'imported.batch': { equals: f.batch } } : {}), ...(f.mode === 'not_activated' ? { activated: { not_equals: true } } : {}) }, sort: 'lastName', limit: 10000, depth: 0, ...q, pagination: false })
  if (!f.team && !f.rfa) return docs
  const kids = await familyKids(p, [...new Set(docs.map(familyId))])
  return docs.filter((u) => {
    const k = kids.get(familyId(u)) ?? []
    return (!f.team || k.some((x) => x.teamId === f.team)) && (!f.rfa || k.some((x) => x.rfa))
  })
}

/** Their personal link: a single-use activation link (14 days), or plain sign-in once they've set up their account; plus a short link on our own domain. */
export async function linksFor(p: Payload, user: User, o: { fresh?: boolean } = {}) {
  let code = user.launch?.shortCode
  if (!code || o.fresh || !user.launch?.shortCodeExpires || new Date(user.launch.shortCodeExpires) < new Date()) {
    code = randomBytes(6).toString('base64url').replace(/[-_]/g, 'x').slice(0, 7)
    await p.update({ collection: 'users', id: user.id, ...q, context: { skipWelcome: true }, data: { launch: { ...(user.launch ?? {}), shortCode: code, shortCodeExpires: new Date(Date.now() + 14 * DAY).toISOString() } } })
  }
  const short = `${siteUrl()}/a/${code}`
  if (user.activated) return { activation: `${siteUrl()}/login?next=/account/app`, short, activated: true }
  const token = await createInvite(p, { userId: user.id, email: user.email, purpose: 'create-account', ttlDays: 14 })
  return { activation: `${siteUrl()}/account/activate?invite=${token}&next=/account/app`, short, activated: false }
}

const time12 = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 || h === 24 ? 'am' : 'pm'}`
}
const span = (w: { from: string; to: string }) => {
  const a = time12(w.from)
  const b = time12(w.to)
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -2)}–${b}` : `${a}–${b}`
}

/** The 1-on-1 hours from Management → Booking hours. */
export async function oneOnOneHours(p: Payload) {
  const { loadBookingHours } = await import('../academy/hours-data')
  const h = await loadBookingHours(p)
  return `School terms – weekdays ${span(h.termWeekday)}, weekends ${span(h.termWeekend)}. School holidays – every day ${span(h.holiday)}.`
}

export async function varsFor(p: Payload, user: User, o: { links: { activation: string; short: string }; kids?: Awaited<ReturnType<typeof familyKids>> }): Promise<MergeVars> {
  const kids = (o.kids ?? (await familyKids(p, [familyId(user)]))).get(familyId(user)) ?? []
  return {
    parent_first_name: user.firstName || 'there',
    player_names: playerNames(kids.map((k) => k.name)) || 'your player',
    player_numbers_list: numbersList(kids),
    activation_link: o.links.activation,
    short_link: o.links.short,
    portal_url: siteUrl(),
    club_phone: clubBrand.phone,
    unsubscribe_link: `${siteUrl()}/unsubscribe/${makeUnsubscribeToken(user.id)}`,
    one_on_one_hours: await oneOnOneHours(p),
    book_link: `${siteUrl()}/login?next=${encodeURIComponent('/academy/1-on-1')}`,
  }
}

export type Kind = 'launch' | 'reminder' | 'followup'

/** The email (and, for the launch, the text) for one parent. */
export function render(s: Pick<Settings, 'launchSubject' | 'launchBody' | 'launchSms' | 'followUpSubject' | 'followUpBody'>, kind: Kind, vars: MergeVars, activated: boolean) {
  const follow = kind === 'followup'
  const subject = fillText(follow ? s.followUpSubject : s.launchSubject, vars, { activated })
  const body = fillText(follow ? s.followUpBody : s.launchBody, vars, { activated })
  // Siblings' numbers go one per line
  const html = emailLayout('club', [{ heading: kind === 'reminder' ? 'Reminder: your portal is ready' : follow ? 'Booking 1-on-1s' : 'Your new portal is ready', intro: toEmailHtml(body) }], { unsubscribeUrl: vars.unsubscribe_link })
  return { subject: kind === 'reminder' ? `Reminder: ${subject}` : subject, html, sms: follow || kind === 'reminder' ? null : toGsm(fillText(s.launchSms, vars, { activated })) }
}

const emailHeaders = (vars: MergeVars) => ({ 'List-Unsubscribe': `<${vars.unsubscribe_link}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' })

/** Send one parent their message. `test` sends to someone else (the Management user) and records nothing. */
export async function sendTo(p: Payload, user: User, kind: Kind, o: { settings?: Settings; kids?: Awaited<ReturnType<typeof familyKids>>; test?: { email: string; phone?: string | null }; smsPhonesDone?: Set<string>; withSms?: boolean } = {}) {
  const settings = o.settings ?? (await launchSettings(p))
  const links = await linksFor(p, user)
  const vars = await varsFor(p, user, { links, kids: o.kids })
  const m = render(settings, kind, vars, links.activated)
  const ok = await sendEmail(p, { to: o.test?.email ?? user.email, subject: o.test ? `[Test] ${m.subject}` : m.subject, html: m.html, sender: 'club', userId: o.test ? undefined : user.id, headers: emailHeaders(vars) })
  const result = { email: ok, sms: null as null | 'sent' | 'failed' | 'skipped' }
  if (o.test) {
    if (m.sms && o.test.phone) result.sms = (await sendSms(p, { to: o.test.phone, body: m.sms, kind: 'service' })).sent ? 'sent' : 'failed'
    return result
  }
  const now = new Date().toISOString()
  const launch = { ...(user.launch ?? {}), shortCode: user.launch?.shortCode, shortCodeExpires: user.launch?.shortCodeExpires }
  const fresh = (await p.findByID({ collection: 'users', id: user.id, depth: 0, ...q })) as User
  Object.assign(launch, { shortCode: fresh.launch?.shortCode, shortCodeExpires: fresh.launch?.shortCodeExpires })
  if (kind === 'followup') Object.assign(launch, { followUpAt: now, followUpStatus: ok ? 'sent' : 'failed', followUpSubject: m.subject })
  else if (kind === 'reminder') Object.assign(launch, { reminderAt: now, emailSubject: m.subject })
  else {
    Object.assign(launch, { emailAt: now, emailStatus: ok ? 'sent' : 'failed', emailSubject: m.subject })
    // One text per unique mobile (siblings' parents sharing a phone get one)
    const phone = toE164(user.phone)
    if (m.sms && o.withSms !== false && phone) {
      const already = o.smsPhonesDone?.has(phone) || (await p.count({ collection: 'users', where: { id: { not_equals: user.id }, or: [{ phoneE164: { equals: phone } }, { phone: { in: [phone, `0${phone.slice(3)}`] } }], 'launch.smsAt': { exists: true } }, ...q })).totalDocs > 0
      if (!already) {
        const r = await sendSms(p, { to: phone, body: m.sms, kind: 'service', optedOut: user.smsOptOut, userId: user.id, statusCallback: `${siteUrl()}/twilio/status` })
        result.sms = r.sent ? 'sent' : r.reason === 'opted_out' ? 'skipped' : 'failed'
        Object.assign(launch, { smsAt: now, smsStatus: result.sms, smsSid: r.sent ? r.sid : null, smsTries: (user.launch?.smsTries ?? 0) + 1 })
      } else {
        result.sms = 'skipped'
        Object.assign(launch, { smsStatus: 'shared' })
      }
      o.smsPhonesDone?.add(phone)
    }
  }
  await p.update({ collection: 'users', id: user.id, ...q, context: { skipWelcome: true }, data: { launch } })
  return result
}

/** What a send would do: how many emails and texts. */
export async function plan(p: Payload, f: Filter) {
  const list = (await recipients(p, f)).filter((u) => !u.launch?.emailAt && !u.launch?.unsubscribedAt)
  const phones = new Set<string>()
  for (const u of list) {
    const ph = toE164(u.phone)
    if (ph && !u.smsOptOut) phones.add(ph)
  }
  return { emails: list.length, texts: phones.size, ids: list.map((u) => u.id) }
}

const smsPause = () => new Promise((r) => setTimeout(r, process.env.TWILIO_ACCOUNT_SID ? 1100 : 0))

/** Send (or carry on sending) the launch to everyone in the run's list who hasn't had it. Stops before `deadline`. */
export async function continueLaunch(p: Payload, deadline = Date.now() + 240_000) {
  const g = await launchSettings(p)
  const run = g.run ?? {}
  if (run.status !== 'sending') return { sent: 0, left: 0 }
  const list = (await recipients(p, (run.filter ?? {}) as Filter)).filter((u) => !u.launch?.emailAt && !u.launch?.unsubscribedAt)
  const kids = await familyKids(p, [...new Set(list.map(familyId))])
  const phones = new Set<string>()
  let sent = 0
  for (const u of list) {
    if (Date.now() > deadline) break
    const r = await sendTo(p, u, 'launch', { settings: g, kids, smsPhonesDone: phones })
    sent++
    if (r.sms === 'sent') await smsPause()
  }
  const left = list.length - sent
  const counts = { ...((run.counts ?? {}) as Record<string, number>), sent: ((run.counts as { sent?: number } | null)?.sent ?? 0) + sent }
  await p.updateGlobal({ slug: 'portal-launch', ...q, data: { run: { ...run, counts, ...(left ? {} : { status: 'done', finishedAt: new Date().toISOString() }) } } })
  return { sent, left }
}

/** Start now, or at a set time (the hourly job starts it). */
export async function startLaunch(p: Payload, o: { filter: Filter; by: User; at?: string | null }) {
  const g = await launchSettings(p)
  const scheduled = o.at && new Date(o.at).getTime() > Date.now()
  await p.updateGlobal({ slug: 'portal-launch', ...q, data: { run: { ...(g.run ?? {}), status: scheduled ? 'scheduled' : 'sending', scheduledFor: scheduled ? o.at : null, filter: o.filter, by: o.by.id, startedAt: scheduled ? null : new Date().toISOString(), finishedAt: null, counts: { sent: 0 } } } })
}

export async function cancelSchedule(p: Payload) {
  const g = await launchSettings(p)
  await p.updateGlobal({ slug: 'portal-launch', ...q, data: { run: { ...(g.run ?? {}), status: 'idle', scheduledFor: null } } })
}

/** Texts that failed: try again (up to 3 tries). */
async function retryTexts(p: Payload, deadline: number) {
  const g = await launchSettings(p)
  const { docs } = await p.find({ collection: 'users', where: { 'launch.smsStatus': { equals: 'failed' }, 'launch.smsTries': { less_than: 3 } }, limit: 200, depth: 0, ...q, pagination: false })
  let retried = 0
  for (const u of docs) {
    if (Date.now() > deadline) break
    const links = await linksFor(p, u)
    const vars = await varsFor(p, u, { links })
    const m = render(g, 'launch', vars, links.activated)
    if (!m.sms) continue
    const r = await sendSms(p, { to: u.phone, body: m.sms, kind: 'service', optedOut: u.smsOptOut, userId: u.id, statusCallback: `${siteUrl()}/twilio/status` })
    const fresh = (await p.findByID({ collection: 'users', id: u.id, depth: 0, ...q })) as User
    await p.update({ collection: 'users', id: u.id, ...q, context: { skipWelcome: true }, data: { launch: { ...(fresh.launch ?? {}), smsStatus: r.sent ? 'sent' : r.reason === 'opted_out' ? 'skipped' : 'failed', smsSid: r.sent ? r.sid : null, smsTries: (fresh.launch?.smsTries ?? 0) + 1, smsAt: new Date().toISOString() } } })
    retried++
    await smsPause()
  }
  return retried
}

/** One reminder email to parents who haven't set up their account X days after the launch email. */
export async function sendLaunchReminders(p: Payload, now = new Date(), deadline = Date.now() + 120_000) {
  const g = await launchSettings(p)
  if (!g.reminderEnabled) return { sent: 0 }
  const before = new Date(now.getTime() - g.reminderDays * DAY).toISOString()
  const { docs } = await p.find({ collection: 'users', where: { 'launch.emailAt': { less_than_equal: before }, 'launch.reminderAt': { exists: false }, 'launch.unsubscribedAt': { exists: false }, activated: { not_equals: true } }, limit: 500, depth: 0, ...q, pagination: false })
  let sent = 0
  for (const u of docs) {
    if (Date.now() > deadline) break
    await sendTo(p, u, 'reminder', { settings: g })
    sent++
  }
  return { sent }
}

/** The 1-on-1 follow-up: X days after each parent's launch email, from 6:30pm Melbourne. */
export async function sendDueFollowUps(p: Payload, now = new Date(), deadline = Date.now() + 120_000) {
  const g = await launchSettings(p)
  if (g.followUpPaused) return { sent: 0 }
  const { docs } = await p.find({ collection: 'users', where: { 'launch.emailAt': { exists: true }, 'launch.followUpAt': { exists: false }, 'launch.unsubscribedAt': { exists: false } }, limit: 1000, depth: 0, ...q, pagination: false })
  const due = docs.filter((u) => followUpDue(u.launch!.emailAt!, g.followUpDays, localToUtc, localYmd).getTime() <= now.getTime())
  let sent = 0
  for (const u of due) {
    if (Date.now() > deadline) break
    await sendTo(p, u, 'followup', { settings: g })
    sent++
  }
  return { sent }
}

/** Send the follow-up now to a filtered list (Management). */
export async function sendFollowUpNow(p: Payload, f: Filter, deadline = Date.now() + 240_000) {
  const g = await launchSettings(p)
  const list = (await recipients(p, f)).filter((u) => u.launch?.emailAt && !u.launch?.followUpAt && !u.launch?.unsubscribedAt)
  let sent = 0
  for (const u of list) {
    if (Date.now() > deadline) break
    await sendTo(p, u, 'followup', { settings: g })
    sent++
  }
  return { sent, left: list.length - sent }
}

/** Hourly: start a scheduled launch when it's due, carry on any send in progress, retry failed texts, send follow-ups. */
export async function launchJob(p: Payload, now = new Date()) {
  const g = await launchSettings(p)
  if (g.run?.status === 'scheduled' && g.run.scheduledFor && new Date(g.run.scheduledFor).getTime() <= now.getTime()) {
    await p.updateGlobal({ slug: 'portal-launch', ...q, data: { run: { ...g.run, status: 'sending', startedAt: now.toISOString() } } })
  }
  const deadline = Date.now() + 200_000
  const launch = await continueLaunch(p, deadline)
  const retried = await retryTexts(p, deadline)
  const follow = await sendDueFollowUps(p, now, deadline)
  return { launch, retried, followUps: follow.sent }
}

/** A fresh activation email (from an expired link). */
export async function emailNewLink(p: Payload, userId: number) {
  const user = (await p.findByID({ collection: 'users', id: userId, depth: 0, ...q })) as User
  if (user.activated) return false
  const links = await linksFor(p, user, { fresh: true })
  const html = emailLayout('club', [{ heading: 'Your new link', intro: `Hi ${user.firstName || 'there'}, here’s a fresh link to open your Rowville Eagles account. It works for 14 days.`, cta: { label: 'Open my account', href: links.activation } }])
  await sendEmail(p, { to: user.email, subject: 'Your new Rowville Eagles account link', html, sender: 'club', userId: user.id })
  return true
}
