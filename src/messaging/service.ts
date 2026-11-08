import type { Payload, Where } from 'payload'
import type { AcademyCoach, AcademyTermSlot, Conversation, User } from '@/payload-types'
import { academyBrand } from '../academy/brand'
import { sendEmail } from '../lib/email'
import { emailLayout, esc } from '../lib/email-templates'
import { siteUrl } from '../lib/payments'
import { sendSms, toE164 } from '../lib/sms'
import { hasRole } from '../access'
import { isUnread, preview, smsReply, type Side } from './rules'

const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null | undefined) ?? null)
const q = { overrideAccess: true } as const
export class MessageError extends Error {}

const nameOf = (u: Pick<User, 'firstName' | 'lastName' | 'email'>) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email
const localNumber = (e164: string) => (/^\+614\d{8}$/.test(e164) ? `0${e164.slice(3, 6)} ${e164.slice(6, 9)} ${e164.slice(9)}` : e164)

/** Coaches who work with this family: 1-on-1 bookings and paid Academy term places. */
export async function familyCoaches(p: Payload, accountId: number) {
  const [bookings, regs] = await Promise.all([
    p.find({ pagination: false, collection: 'academy-bookings', where: { account: { equals: accountId }, status: { in: ['confirmed', 'completed', 'payment_failed'] } }, limit: 200, depth: 0, ...q, select: { coach: true } }),
    p.find({ pagination: false, collection: 'academy-registrations', where: { account: { equals: accountId }, status: { equals: 'paid' } }, limit: 100, depth: 1, ...q, select: { slot: true, groupId: true } }),
  ])
  const ids = new Set<number>(bookings.docs.map((b) => rel(b.coach)).filter((x): x is number => x != null))
  for (const r of regs.docs) {
    const slot = r.slot as AcademyTermSlot | null
    if (!slot || typeof slot !== 'object') continue
    for (const c of slot.coaches ?? []) ids.add(rel(c)!)
    for (const g of slot.groups ?? []) if (!r.groupId || g.id === r.groupId) for (const c of g.coaches ?? []) ids.add(rel(c)!)
  }
  return [...ids]
}

/** The family's conversation (or an unknown number's), created on first use; its coaches kept current. */
export async function conversationFor(p: Payload, o: { account?: User | null; phone?: string | null }) {
  if (o.account) {
    const { docs } = await p.find({ pagination: false, collection: 'conversations', where: { account: { equals: o.account.id } }, limit: 1, depth: 0, ...q })
    const coaches = await familyCoaches(p, o.account.id)
    if (docs[0]) {
      const same = (docs[0].coaches ?? []).map(rel).sort().join() === [...coaches].sort().join()
      return same ? docs[0] : p.update({ collection: 'conversations', id: docs[0].id, ...q, data: { coaches } })
    }
    return p.create({ collection: 'conversations', ...q, data: { title: nameOf(o.account), account: o.account.id, coaches } })
  }
  const phone = toE164(o.phone) ?? o.phone ?? 'unknown'
  const { docs } = await p.find({ pagination: false, collection: 'conversations', where: { phone: { equals: phone }, account: { exists: false } }, limit: 1, depth: 0, ...q })
  return docs[0] ?? p.create({ collection: 'conversations', ...q, data: { title: `Unknown number ${localNumber(phone)}`, phone, coaches: [] } })
}

type NewMessage = { direction: 'in' | 'out' | 'note'; channel: 'sms' | 'portal' | 'email' | 'system'; authorRole: 'family' | 'coach' | 'admin' | 'system'; author?: number; authorName?: string; body: string; delivery?: 'sms' | 'email' | 'failed' | 'received'; twilioSid?: string }

export async function addMessage(p: Payload, conv: Conversation, m: NewMessage) {
  const now = new Date().toISOString()
  const msg = await p.create({ collection: 'messages', ...q, data: { conversation: conv.id, ...m } })
  const fromFamily = m.direction === 'in'
  const reads = (conv.reads ?? []).filter((r) => rel(r.user) !== m.author)
  await p.update({
    collection: 'conversations',
    id: conv.id,
    ...q,
    data: {
      lastMessageAt: now,
      lastPreview: preview(m.body),
      ...(fromFamily ? { lastFamilyAt: now } : m.direction === 'out' ? { lastStaffAt: now } : {}),
      // Whoever wrote it has read the conversation
      ...(m.author ? { reads: [...reads.map((r) => ({ user: rel(r.user)!, at: r.at })), { user: m.author, at: now }] } : {}),
    },
  })
  return msg
}

export async function markRead(p: Payload, conv: Conversation, userId: number) {
  const reads = (conv.reads ?? []).filter((r) => rel(r.user) !== userId).map((r) => ({ user: rel(r.user)!, at: r.at }))
  await p.update({ collection: 'conversations', id: conv.id, ...q, data: { reads: [...reads, { user: userId, at: new Date().toISOString() }] } })
}

export type Viewer = { user: User; side: Side; coach?: AcademyCoach | null }

export async function viewerFor(p: Payload, user: User | null): Promise<Viewer | null> {
  if (!user) return null
  if (hasRole(user, 'admin', 'committee')) return { user, side: 'management' }
  const { docs } = await p.find({ pagination: false, collection: 'academy-coaches', where: { user: { equals: user.id } }, limit: 1, depth: 0, ...q })
  if (docs[0]) return { user, side: 'coach', coach: docs[0] }
  return { user, side: 'family' }
}

export function canSee(v: Viewer, conv: Conversation) {
  if (v.side === 'management') return true
  if (v.side === 'coach') return (conv.coaches ?? []).map(rel).includes(v.coach!.id)
  return rel(conv.account) === v.user.id
}

/** Conversations this viewer can see, newest first, with unread flags. */
export async function inbox(p: Payload, v: Viewer, o: { filter?: 'all' | 'unassigned' } = {}) {
  const where: Where =
    v.side === 'management'
      ? o.filter === 'unassigned' ? { account: { exists: false } } : {}
      : v.side === 'coach' ? { coaches: { contains: v.coach!.id } } : { account: { equals: v.user.id } }
  const { docs } = await p.find({ pagination: false, collection: 'conversations', where: { ...where, lastMessageAt: { exists: true } }, sort: '-lastMessageAt', limit: 300, depth: 0, ...q })
  return docs.map((c) => ({ conv: c, unread: isUnread(c, v.user.id, v.side === 'family' ? 'family' : 'management') }))
}

export async function unreadCount(p: Payload, v: Viewer | null) {
  if (!v) return 0
  // Only the fields needed to tell read from unread (badges ask often)
  const where: Where = v.side === 'management' ? {} : v.side === 'coach' ? { coaches: { contains: v.coach!.id } } : { account: { equals: v.user.id } }
  const { docs } = await p.find({ pagination: false, collection: 'conversations', where: { ...where, lastMessageAt: { exists: true } }, sort: '-lastMessageAt', limit: 300, depth: 0, ...q, select: { reads: true, lastFamilyAt: true, lastStaffAt: true } })
  return docs.filter((c) => isUnread(c as never, v.user.id, v.side === 'family' ? 'family' : 'management')).length
}

export async function thread(p: Payload, conv: Conversation) {
  const { docs } = await p.find({ pagination: false, collection: 'messages', where: { conversation: { equals: conv.id } }, sort: 'createdAt', limit: 500, depth: 0, ...q })
  return docs
}

/** Tell the family's coaches (or the academy inbox, if nobody's assigned) — at most once every 10 minutes per conversation. */
async function alertStaff(p: Payload, conv: Conversation, text: string, via: string) {
  if (conv.lastAlertAt && Date.now() - new Date(conv.lastAlertAt).getTime() < 10 * 60_000) return
  await p.update({ collection: 'conversations', id: conv.id, ...q, data: { lastAlertAt: new Date().toISOString() } })
  const coachIds = (conv.coaches ?? []).map(rel).filter((x): x is number => x != null)
  const coaches = coachIds.length ? (await p.find({ pagination: false, collection: 'academy-coaches', where: { id: { in: coachIds } }, depth: 1, limit: 20, ...q })).docs : []
  const to = coaches.map((c) => (typeof c.user === 'object' ? (c.user as User | null)?.email : null)).filter((e): e is string => Boolean(e))
  const send = async (email: string, href: string) =>
    sendEmail(p, {
      to: email,
      subject: `New message from ${conv.title}`,
      html: emailLayout('academy', [{ heading: 'New message', intro: `${esc(conv.title)} sent a message (${esc(via)}):<br><br><strong style="white-space:pre-wrap">${esc(text)}</strong>`, rows: [], cta: { label: 'Open the conversation', href } }]),
      sender: 'academy',
    })
  for (const email of to) await send(email, `${siteUrl()}/coach/messages/${conv.id}`)
  if (!to.length) await send(academyBrand.email, `${siteUrl()}/management/messages/${conv.id}`)
}

/** A text arrived on the Twilio number. */
export async function receiveSms(p: Payload, o: { from: string; body: string; sid?: string; media?: number; users: User[] }) {
  const conv = await conversationFor(p, { account: o.users[0] ?? null, phone: o.from })
  const body = (o.body || '(no text)') + (o.media ? ` [+${o.media} photo/file — view it in the Twilio console]` : '')
  await addMessage(p, conv, { direction: 'in', channel: 'sms', authorRole: 'family', author: o.users[0]?.id, authorName: o.users[0] ? nameOf(o.users[0]) : localNumber(o.from), body, delivery: 'received', twilioSid: o.sid })
  await alertStaff(p, await p.findByID({ collection: 'conversations', id: conv.id, depth: 0, ...q }), body, 'by text')
  return conv
}

export async function systemNote(p: Payload, o: { users: User[]; phone: string; body: string }) {
  const conv = await conversationFor(p, { account: o.users[0] ?? null, phone: o.phone })
  await addMessage(p, conv, { direction: 'note', channel: 'system', authorRole: 'system', body: o.body })
}

/** The family wrote in their portal. */
export async function familyPost(p: Payload, user: User, text: string) {
  const body = text.trim().slice(0, 1600)
  if (!body) throw new MessageError('Write a message first.')
  const conv = await conversationFor(p, { account: user })
  await addMessage(p, conv, { direction: 'in', channel: 'portal', authorRole: 'family', author: user.id, authorName: nameOf(user), body })
  await alertStaff(p, await p.findByID({ collection: 'conversations', id: conv.id, depth: 0, ...q }), body, 'in the player portal')
  return conv
}

/**
 * A coach or admin replies. It's texted to the parent/guardian's mobile on their account (never a player's own
 * number); if that isn't possible (no mobile, replied STOP, texting not set up) it's emailed instead.
 */
export async function staffReply(p: Payload, v: Viewer, convId: number, text: string) {
  if (v.side === 'family') throw new MessageError('Not allowed.')
  const conv = await p.findByID({ collection: 'conversations', id: convId, depth: 0, ...q, disableErrors: true })
  if (!conv || !canSee(v, conv)) throw new MessageError('Conversation not found.')
  const body = text.trim().slice(0, 1200)
  if (!body) throw new MessageError('Write a message first.')
  const authorName = v.side === 'coach' ? v.coach!.displayName : v.user.firstName?.trim() || 'Foundation Academy'
  const family = conv.account ? await p.findByID({ collection: 'users', id: rel(conv.account)!, depth: 0, ...q, disableErrors: true }) : null
  const to = family ? family.phone : conv.phone
  const sms = await sendSms(p, { to, kind: 'service', optedOut: family?.smsOptOut, userId: family?.id, body: smsReply(body, authorName) })
  let delivery: 'sms' | 'email' | 'failed' = sms.sent ? 'sms' : 'failed'
  if (!sms.sent && family) {
    await sendEmail(p, {
      to: family.email,
      subject: `Message from ${authorName}, Foundation Academy`,
      html: emailLayout('academy', [{ heading: `Message from ${esc(authorName)}`, intro: `<span style="white-space:pre-wrap">${esc(body)}</span>`, rows: [], cta: { label: 'Reply in the player portal', href: `${siteUrl()}/account/messages` } }]),
      sender: 'academy',
      userId: family.id,
    })
    delivery = 'email'
  }
  await addMessage(p, conv, { direction: 'out', channel: delivery === 'email' ? 'email' : 'sms', authorRole: v.side === 'coach' ? 'coach' : 'admin', author: v.user.id, authorName, body, delivery })
  return { delivery, reason: sms.sent ? null : (sms as { reason?: string }).reason }
}

/** Admins: link an unknown number's conversation to a family account (its messages move with it). */
export async function assignToAccount(p: Payload, convId: number, email: string) {
  const conv = await p.findByID({ collection: 'conversations', id: convId, depth: 0, ...q, disableErrors: true })
  if (!conv || conv.account) throw new MessageError('Only unassigned conversations can be linked.')
  const user = (await p.find({ pagination: false, collection: 'users', where: { email: { equals: email.trim().toLowerCase() } }, limit: 1, depth: 0, ...q })).docs[0]
  if (!user) throw new MessageError('No account with that email.')
  const target = await conversationFor(p, { account: user })
  await p.update({ collection: 'messages', where: { conversation: { equals: conv.id } }, ...q, data: { conversation: target.id } })
  await p.update({ collection: 'conversations', id: target.id, ...q, data: { lastMessageAt: conv.lastMessageAt ?? target.lastMessageAt, lastFamilyAt: conv.lastFamilyAt ?? target.lastFamilyAt, lastPreview: conv.lastPreview ?? target.lastPreview } })
  await p.delete({ collection: 'conversations', id: conv.id, ...q })
  return target
}

/** Families a coach can start a conversation with (they've booked or are in the coach's groups). */
export async function coachFamilies(p: Payload, coachId: number) {
  const [bookings, slots] = await Promise.all([
    p.find({ pagination: false, collection: 'academy-bookings', where: { coach: { equals: coachId }, status: { in: ['confirmed', 'completed', 'payment_failed'] }, account: { exists: true } }, limit: 500, depth: 0, ...q, select: { account: true } }),
    p.find({ pagination: false, collection: 'academy-term-slots', where: { or: [{ coaches: { contains: coachId } }, { 'groups.coaches': { contains: coachId } }] }, limit: 200, depth: 0, ...q, select: { coaches: true } }),
  ])
  const regs = slots.docs.length
    ? await p.find({ pagination: false, collection: 'academy-registrations', where: { slot: { in: slots.docs.map((s) => s.id) }, status: { equals: 'paid' }, account: { exists: true } }, limit: 1000, depth: 0, ...q, select: { account: true } })
    : { docs: [] as { account?: unknown }[] }
  const ids = [...new Set([...bookings.docs, ...regs.docs].map((d) => rel(d.account)).filter((x): x is number => x != null))]
  if (!ids.length) return []
  const { docs } = await p.find({ pagination: false, collection: 'users', where: { id: { in: ids } }, limit: ids.length, depth: 0, ...q, select: { firstName: true, lastName: true, email: true } })
  return docs.map((u) => ({ id: u.id, name: nameOf(u as User) })).sort((a, b) => a.name.localeCompare(b.name))
}

/** "Seen" under the viewer's latest message (see receipts.ts). Family view names who read it. */
export async function receiptFor(p: Payload, conv: Conversation, msgs: { id: number; direction: string; createdAt: string }[], side: 'family' | 'management') {
  const reads = (conv.reads ?? []).map((r) => ({ user: rel(r.user)!, at: r.at }))
  const familyUserId = rel(conv.account)
  let names: Record<number, string> = {}
  if (side === 'family') {
    const ids = reads.map((r) => r.user).filter((id) => id !== familyUserId)
    if (ids.length) {
      const [{ docs: users }, { docs: coaches }] = await Promise.all([
        p.find({ pagination: false, collection: 'users', where: { id: { in: ids } }, depth: 0, limit: 50, ...q, select: { firstName: true } }),
        p.find({ pagination: false, collection: 'academy-coaches', where: { user: { in: ids } }, depth: 0, limit: 50, ...q, select: { displayName: true, user: true } }),
      ])
      names = Object.fromEntries(users.map((u) => [u.id, u.firstName || 'the Academy']))
      for (const c of coaches) if (rel(c.user)) names[rel(c.user)!] = c.displayName
    }
  }
  const { seenReceipt } = await import('./receipts')
  return seenReceipt(msgs, reads, { side, familyUserId, names })
}

let replyMemo: { at: number; label: string | null } | null = null
/** "Usually replies within 3 hours", from the last 90 days of replies (worked out at most once an hour). */
export async function replyTimeHint(p: Payload) {
  if (replyMemo && Date.now() - replyMemo.at < 3_600_000) return replyMemo.label
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString()
  const { docs } = await p.find({ pagination: false, collection: 'messages', where: { createdAt: { greater_than: since }, direction: { in: ['in', 'out'] } }, sort: 'createdAt', limit: 5000, depth: 0, ...q, select: { direction: true, createdAt: true, conversation: true } })
  const { replyTimeLabel, typicalReplyMinutes } = await import('./receipts')
  replyMemo = { at: Date.now(), label: replyTimeLabel(typicalReplyMinutes(docs as never)) }
  return replyMemo.label
}
