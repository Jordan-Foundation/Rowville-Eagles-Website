import type { Payload, PayloadRequest } from 'payload'
import type { User } from '@/payload-types'
import { accountMemberships } from './accounts'
import { APP, appBrandFor, type AppBrand } from './app-brand'
import { emailLayout, esc } from './email-templates'
import { sendEmail } from './email'
import { siteUrl } from './payments'

/**
 * "Get the app": install the portal to the home screen and turn on notifications.
 * - New accounts get a welcome email with the app guide when they set their password, and one reminder 3 days later
 *   if they still haven't done both steps.
 * - Their homepage shows a task card until both steps are done ("Remind me later" hides it for 7 days).
 * - All notification types are on for new accounts; each can be turned off in Preferences.
 */

export const SNOOZE_DAYS = 7
export const APP_REMINDER_DAYS = 3
const DAY = 86_400_000

export const APP_BENEFITS = [
  'Session reminders so you never miss training or a 1-on-1',
  'Instant alerts if a session is changed, moved or cancelled (e.g. weather)',
  'Fixture and team updates as soon as they’re posted',
  'First access when new holiday camp and 1-on-1 slots open',
  'Messages from coaches and the club',
  'Your player’s progress, badges and reports in one tap',
  'One tap to book and pay — no searching for a link',
]

export const NOTIFY_TYPES = [
  { key: 'reminders', label: 'Session reminders' },
  { key: 'changes', label: 'Changes and cancellations' },
  { key: 'teams', label: 'Fixtures and team updates' },
  { key: 'openings', label: 'New holiday camps and 1-on-1 times' },
  { key: 'messages', label: 'Messages from coaches and the club' },
  { key: 'progress', label: 'Progress, badges and reports' },
] as const
export type NotifyType = (typeof NOTIFY_TYPES)[number]['key']

type AppFields = Pick<User, 'app'>

/** Pure: where someone is with the app (both steps, and whether the homepage card shows). */
export function appProgress(u: AppFields, now = new Date()) {
  const installed = Boolean(u.app?.installedAt)
  const push = Boolean(u.app?.pushEnabledAt)
  const done = installed && push
  const snoozed = Boolean(u.app?.cardSnoozedUntil && new Date(u.app.cardSnoozedUntil).getTime() > now.getTime())
  return { installed, push, done, showCard: !done && !snoozed }
}

/** Pure: is the one reminder due? (Welcome sent 3+ days ago, no reminder yet, steps not done.) */
export function appReminderDue(u: AppFields, now = new Date()) {
  if (!u.app?.welcomeSentAt || u.app.reminderSentAt) return false
  if (appProgress(u, now).done) return false
  return now.getTime() - new Date(u.app.welcomeSentAt).getTime() >= APP_REMINDER_DAYS * DAY
}

/** Which app (Rowville Eagles or Foundation Academy) this account gets. */
export async function appBrandOf(p: Payload, user: Pick<User, 'id' | 'roles'>): Promise<AppBrand> {
  return appBrandFor({ memberships: [...(await accountMemberships(p, user.id))], roles: user.roles })
}

export const walkthroughUrl = () => `${siteUrl()}/account/app`

/** The "Get the app" email section (welcome and reminder). */
export function appGuideBlocks(brand: AppBrand, o: { reminder?: boolean } = {}) {
  const name = APP[brand].name
  return [
    {
      heading: o.reminder ? `Still to do: get the ${name} app` : `Get the ${name} app`,
      intro: `${o.reminder ? 'It only takes a minute. ' : ''}Add ${esc(name)} to your phone’s home screen and turn on notifications so you never miss a thing:<br><br>${APP_BENEFITS.map((b) => `✓ ${esc(b)}`).join('<br>')}`,
      cta: { label: 'Get the app', href: walkthroughUrl() },
      after:
        '<strong>iPhone:</strong> open the link in Safari → tap Share → Add to Home Screen → Add. Open the app from your Home Screen, tap “Turn on notifications” → Allow.<br><br>' +
        '<strong>Android:</strong> open the link in Chrome → tap “Install app” (or menu ⋮ → Install app). Then tap “Turn on notifications” → Allow.',
    },
  ]
}

/** Welcome email (with the app guide) — once, when a family account is set up. */
export async function sendWelcomeEmail(p: Payload, user: User, req?: PayloadRequest) {
  if (user.app?.welcomeSentAt) return false
  const roles = user.roles ?? []
  if (!roles.some((r) => r === 'parent' || r === 'player')) return false // coaches and Management have their own set-up
  // Claim first so it can only ever go once
  await p.update({ collection: 'users', id: user.id, data: { app: { ...(user.app ?? {}), welcomeSentAt: new Date().toISOString() } }, overrideAccess: true, req, context: { skipWelcome: true } })
  const brand = await appBrandOf(p, user)
  const html = emailLayout(brand === 'academy' ? 'academy' : 'club', [
    {
      heading: `Welcome${user.firstName ? `, ${user.firstName}` : ''}`,
      intro: `Your ${esc(APP[brand].name)} account is ready. Your bookings, sessions, payments and players are all in one place.`,
      cta: { label: 'Go to my account', href: `${siteUrl()}/account` },
    },
    ...appGuideBlocks(brand),
  ])
  await sendEmail(p, { to: user.email, subject: `Welcome to ${APP[brand].name} — get the app`, html, sender: brand === 'academy' ? 'academy' : 'club', userId: user.id })
  return true
}

/** Daily: the one reminder, 3 days after the welcome email, if the app and notifications still aren't both set up. */
export async function sendAppReminders(p: Payload, now = new Date()) {
  const result = { checked: 0, sent: 0 }
  const { docs } = await p.find({
    collection: 'users',
    where: { 'app.welcomeSentAt': { less_than_equal: new Date(now.getTime() - APP_REMINDER_DAYS * DAY).toISOString() }, 'app.reminderSentAt': { exists: false } },
    limit: 500,
    depth: 0,
    overrideAccess: true,
    pagination: false,
  })
  for (const u of docs) {
    result.checked++
    if (!appReminderDue(u, now)) continue
    await p.update({ collection: 'users', id: u.id, data: { app: { ...(u.app ?? {}), reminderSentAt: now.toISOString() } }, overrideAccess: true, context: { skipWelcome: true } })
    const brand = await appBrandOf(p, u)
    const html = emailLayout(brand === 'academy' ? 'academy' : 'club', appGuideBlocks(brand, { reminder: true }))
    await sendEmail(p, { to: u.email, subject: `Don’t miss a session — get the ${APP[brand].name} app`, html, sender: brand === 'academy' ? 'academy' : 'club', userId: u.id })
    result.sent++
  }
  return result
}

/** Record a step (first time only). */
export async function recordAppStep(p: Payload, userId: number, step: 'installed' | 'push') {
  const u = await p.findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true })
  const field = step === 'installed' ? 'installedAt' : 'pushEnabledAt'
  if (u.app?.[field]) return false
  await p.update({ collection: 'users', id: userId, data: { app: { ...(u.app ?? {}), [field]: new Date().toISOString() } }, overrideAccess: true, context: { skipWelcome: true } })
  return true
}

export async function snoozeAppCard(p: Payload, userId: number, now = new Date()) {
  const u = await p.findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true })
  await p.update({ collection: 'users', id: userId, data: { app: { ...(u.app ?? {}), cardSnoozedUntil: new Date(now.getTime() + SNOOZE_DAYS * DAY).toISOString() } }, overrideAccess: true, context: { skipWelcome: true } })
}

/**
 * A phone notification to a family member, if they have this notification type on (all on by default).
 * Never throws — notifications are extra to the email or text that already goes.
 */
export async function notifyUser(p: Payload, userId: number | null | undefined, type: NotifyType, msg: { title: string; body: string; url: string; tag?: string }) {
  if (!userId) return 0
  try {
    const u = await p.findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true, disableErrors: true })
    if (!u || u.notify?.[type] === false) return 0
    const { pushTo } = await import('../push/send')
    return await pushTo(p, userId, { ...msg, icon: APP[await appBrandOf(p, u)].icon192 })
  } catch (e) {
    p.logger.error({ err: e, msg: `Notification (${type}) to user ${userId} failed` })
    return 0
  }
}

/** Same notification to every account linked to these emails (e.g. a booking's contact). */
export async function notifyEmail(p: Payload, email: string | null | undefined, type: NotifyType, msg: Parameters<typeof notifyUser>[3]) {
  if (!email) return 0
  const { docs } = await p.find({ collection: 'users', where: { email: { equals: email.trim().toLowerCase() } }, limit: 1, depth: 0, overrideAccess: true, pagination: false, select: { email: true } })
  return docs[0] ? notifyUser(p, docs[0].id, type, msg) : 0
}

/** The same notification to many accounts — only those with a device turned on are looked up. */
export async function notifyMany(p: Payload, userIds: number[], type: NotifyType, msg: Parameters<typeof notifyUser>[3]) {
  if (!userIds.length) return 0
  const { docs } = await p.find({ collection: 'push-subscriptions', where: { user: { in: userIds } }, limit: 5000, depth: 0, overrideAccess: true, pagination: false, select: { user: true } })
  const withDevice = [...new Set(docs.map((d) => (typeof d.user === 'object' ? d.user.id : d.user)))]
  let reached = 0
  for (const id of withDevice) reached += await notifyUser(p, id, type, msg)
  return reached
}

/**
 * Hourly: a phone reminder for each 1-on-1 / small group session starting in the next day (once per session).
 * Only families with notifications on get one — nothing else is sent.
 */
export async function sendSessionReminderPushes(p: Payload, now = new Date()) {
  const { formatDate } = await import('./format')
  const { docs } = await p.find({
    collection: 'academy-sessions',
    where: {
      status: { equals: 'scheduled' },
      kind: { in: ['one-on-one', 'group-player'] },
      account: { exists: true },
      reminderSentAt: { exists: false },
      startsAt: { greater_than: new Date(now.getTime() + 2 * 3_600_000).toISOString(), less_than_equal: new Date(now.getTime() + 26 * 3_600_000).toISOString() },
    },
    limit: 500,
    depth: 1,
    overrideAccess: true,
    pagination: false,
  })
  let sent = 0
  for (const s of docs) {
    const claimed = await p.update({ collection: 'academy-sessions', where: { id: { equals: s.id }, reminderSentAt: { exists: false } }, data: { reminderSentAt: now.toISOString() }, overrideAccess: true, depth: 0 })
    if (!claimed.docs.length) continue
    const b = typeof s.booking === 'object' ? s.booking : null
    const coach = typeof s.coach === 'object' ? s.coach.displayName : 'your coach'
    const when = formatDate(s.startsAt, { weekday: 'long', hour: 'numeric', minute: '2-digit' })
    const userId = typeof s.account === 'object' ? s.account?.id : s.account
    sent += await notifyUser(p, userId, 'reminders', {
      title: `${b?.player?.firstName ? `${b.player.firstName}’s` : 'Your'} ${s.kind === 'group-player' ? 'small group' : '1-on-1'} is ${localDay(s.startsAt) === localDay(now) ? 'today' : 'tomorrow'}`,
      body: `${when} with ${coach}. Bring boots, shin pads, a ball and water.`,
      url: b?.reference ? `/account/bookings/${b.reference}` : '/account',
      tag: `session-${s.id}`,
    })
  }
  return { due: docs.length, sent }
}
const localDay = (d: string | Date) => new Date(d).toLocaleDateString('en-AU', { timeZone: 'Australia/Melbourne' })
