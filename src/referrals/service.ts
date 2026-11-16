import { randomBytes } from 'node:crypto'
import type { Payload, Where } from 'payload'
import type { AcademyBooking, Booking, Participant, Program, Referral, ReferralMilestone, User } from '../payload-types'
import { emailLayout, esc } from '../lib/email-templates'
import { sendEmail } from '../lib/email'
import { siteUrl } from '../lib/payments'
import { academyBrand } from '../academy/brand'
import { bookingReferralProgram, programLabel, type ReferralProgram } from './programs'
import { chooseAttribution, confirmAfterFor, DEFAULT_MILESTONES, e164, makeCode, milestonesDue, normaliseCode } from './rules'

const q = { overrideAccess: true, depth: 0 } as const
const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null | undefined)) ?? null
const lc = (s?: string | null) => (s ?? '').trim().toLowerCase()

export class ReferralError extends Error {}
export const REF_COOKIE = 'rfa_ref'

export async function referralSettings(p: Payload) {
  const s = await p.findGlobal({ slug: 'referral-settings', ...q }).catch(() => null)
  return {
    enabled: s?.enabled !== false,
    windows: { eagles: s?.windows?.eagles ?? 14, 'academy-term': s?.windows?.academyTerm ?? 14, 'holiday-camp': s?.windows?.holidayCamp ?? 14, 'mini-ballers': s?.windows?.miniBallers ?? 14, 'one-on-one': 0 } as Record<ReferralProgram, number>,
    dailyInviteLimit: s?.dailyInviteLimit ?? 10,
    inviteExpiryDays: s?.inviteExpiryDays ?? 60,
  }
}

/** The milestone table, seeded with the five standard rewards the first time it's needed. */
export async function milestones(p: Payload) {
  let { docs } = await p.find({ collection: 'referral-milestones', sort: 'threshold', limit: 100, pagination: false, ...q })
  if (!docs.length) {
    for (const m of DEFAULT_MILESTONES) await p.create({ collection: 'referral-milestones', ...q, data: { ...m, active: true } }).catch(() => null)
    docs = (await p.find({ collection: 'referral-milestones', sort: 'threshold', limit: 100, pagination: false, ...q })).docs
  }
  return docs as ReferralMilestone[]
}

/** The player's code (made the first time it's needed). */
export async function codeFor(p: Payload, participant: Participant) {
  if (participant.referralCode) return participant.referralCode
  for (let i = 0; i < 6; i++) {
    const code = makeCode(participant.firstName, (n) => [...randomBytes(n)])
    try {
      await p.update({ collection: 'participants', id: participant.id, ...q, data: { referralCode: code } })
      return code
    } catch {
      /* code already taken — try another */
    }
  }
  throw new ReferralError('Couldn’t make a referral code — please try again.')
}

export const referralLink = (code: string, token?: string | null) => `${siteUrl()}/refer/${code}${token ? `?i=${token}` : ''}`

/** The player behind a code, with their parent's first name (for "Sam invited you"). */
export async function resolveCode(p: Payload, raw: unknown) {
  const code = normaliseCode(raw)
  if (!code) return null
  const kid = (await p.find({ collection: 'participants', where: { referralCode: { equals: code } }, limit: 1, pagination: false, ...q })).docs[0]
  if (!kid) return null
  const parent = rel(kid.account) ? await p.findByID({ collection: 'users', id: rel(kid.account)!, ...q, disableErrors: true }) : null
  return { code, participant: kid, parent }
}

/**
 * Is this family already part of the club? (Any account, booking, 1-on-1, Academy registration or trial sign-up
 * with this email or mobile — created before `before`, when given.)
 */
export async function existingFamily(p: Payload, o: { email?: string | null; phone?: string | null; before?: string; ignore?: { collection: string; id: number }[] }) {
  const email = lc(o.email)
  const phone = e164(o.phone)
  const local = phone ? `0${phone.slice(3)}` : null
  const phones = [phone, local].filter(Boolean) as string[]
  const time: Where[] = o.before ? [{ createdAt: { less_than: o.before } }] : []
  // Real activity only: an account, something paid, or a trial sign-up (an unpaid interest form doesn't make a family 'existing')
  const checks: { collection: 'users' | 'bookings' | 'academy-bookings' | 'academy-registrations' | 'selection-entries'; status?: string[]; or: Where[] }[] = [
    { collection: 'users', or: [...(email ? [{ email: { equals: email } }] : []), ...phones.map((x) => ({ phone: { equals: x } }))] },
    { collection: 'bookings', status: ['paid', 'refunded'], or: [...(email ? [{ 'contact.email': { equals: email } }] : []), ...phones.map((x) => ({ 'contact.phone': { equals: x } }))] },
    { collection: 'academy-bookings', status: ['confirmed', 'completed', 'payment_failed', 'refunded'], or: [...(email ? [{ 'contact.email': { equals: email } }] : []), ...phones.map((x) => ({ 'contact.mobile': { equals: x } }))] },
    { collection: 'academy-registrations', status: ['paid'], or: [...(email ? [{ 'contact.email': { equals: email } }] : []), ...phones.map((x) => ({ 'contact.phone': { equals: x } }))] },
    { collection: 'selection-entries', or: [...(email ? [{ 'contact.email': { equals: email } }] : []), ...phones.map((x) => ({ 'contact.phone': { equals: x } }))] },
  ]
  for (const c of checks) {
    if (!c.or.length) continue
    const ignore = (o.ignore ?? []).filter((x) => x.collection === c.collection).map((x) => x.id)
    const where: Where = { and: [{ or: c.or }, ...time, ...(c.status ? [{ status: { in: c.status } }] : []), ...(ignore.length ? [{ id: { not_in: ignore } }] : [])] }
    const { totalDocs } = await p.count({ collection: c.collection, where, overrideAccess: true }).catch(() => ({ totalDocs: 0 }))
    if (totalDocs) return true
  }
  return false
}

/** Parent: make a share link for one friend (the parent sends it themselves). */
export async function createInvite(p: Payload, user: User, o: { participantId: number; name?: string; email?: string; phone?: string; featured: ReferralProgram }) {
  if (!user.roles?.includes('parent')) throw new ReferralError('Only parent accounts can invite friends.')
  const s = await referralSettings(p)
  if (!s.enabled) throw new ReferralError('Refer a Friend is paused at the moment.')
  const kid = await p.findByID({ collection: 'participants', id: o.participantId, ...q, disableErrors: true })
  if (!kid || rel(kid.account) !== user.id) throw new ReferralError('Choose one of your players.')
  const email = lc(o.email) || null
  const phone = o.phone?.replace(/\s+/g, '') || null
  if (!email && !phone) throw new ReferralError('Add your friend’s email or mobile, so we know it’s them when they sign up.')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ReferralError('Check the email address.')
  if (phone && !e164(phone)) throw new ReferralError('Check the mobile number (Australian mobiles only).')
  if (email && email === lc(user.email)) throw new ReferralError('That’s your own email — invite someone new.')
  if (await existingFamily(p, { email, phone })) throw new ReferralError('Good news — that family is already part of the club, so they can’t be referred.')
  const today = new Date(Date.now() - 86_400_000).toISOString()
  const { totalDocs } = await p.count({ collection: 'referral-invites', where: { sentBy: { equals: user.id }, createdAt: { greater_than: today } }, overrideAccess: true })
  if (totalDocs >= s.dailyInviteLimit) throw new ReferralError(`You’ve made ${s.dailyInviteLimit} invite links today — please try again tomorrow.`)
  const code = await codeFor(p, kid)
  const token = randomBytes(9).toString('base64url')
  const invite = await p.create({
    collection: 'referral-invites',
    ...q,
    data: { token, referrer: kid.id, sentBy: user.id, inviteeName: o.name?.trim().slice(0, 80) || null, inviteeEmail: email, inviteePhone: phone ? e164(phone) : null, featured: o.featured, status: 'invited', expiresAt: new Date(Date.now() + s.inviteExpiryDays * 86_400_000).toISOString() },
  })
  return { invite, link: referralLink(code, token) }
}

/** The invite behind a link token, if it belongs to this code. */
export async function inviteFor(p: Payload, code: string, token?: string | null) {
  if (!token) return null
  const inv = (await p.find({ collection: 'referral-invites', where: { token: { equals: token } }, limit: 1, pagination: false, ...q })).docs[0]
  if (!inv) return null
  const kid = await p.findByID({ collection: 'participants', id: rel(inv.referrer)!, ...q, disableErrors: true })
  return kid?.referralCode === code ? inv : null
}

/** Save the code a family arrived with on their account (first one wins; never removed). */
export async function saveCodeOnAccount(p: Payload, accountId: number | null | undefined, code: string | null | undefined) {
  if (!accountId || !code) return
  const u = await p.findByID({ collection: 'users', id: accountId, ...q, disableErrors: true })
  if (!u || u.referralCode) return
  const r = await resolveCode(p, code)
  if (!r || rel(r.participant.account) === accountId) return
  await p.update({ collection: 'users', id: accountId, ...q, data: { referralCode: r.code, referralCodeAt: new Date().toISOString() } })
}

/** Invites that match this email / mobile (for "signed up" / "trial registered" and attribution). */
async function matchingInvites(p: Payload, email?: string | null, phone?: string | null) {
  const or: Where[] = [...(lc(email) ? [{ inviteeEmail: { equals: lc(email) } }] : []), ...(e164(phone) ? [{ inviteePhone: { equals: e164(phone) } }] : [])]
  if (!or.length) return []
  return (await p.find({ collection: 'referral-invites', where: { or }, sort: 'createdAt', limit: 20, pagination: false, ...q })).docs
}

const STAGE = { invited: 0, signed_up: 1, trial_registered: 2, paid: 3, expired: -1 } as const
/** Move matching invites forward (never backwards). */
export async function advanceInvites(p: Payload, o: { email?: string | null; phone?: string | null; token?: string | null; status: 'signed_up' | 'trial_registered' | 'paid'; account?: number | null }) {
  const list = await matchingInvites(p, o.email, o.phone)
  if (o.token) {
    const byToken = (await p.find({ collection: 'referral-invites', where: { token: { equals: o.token } }, limit: 1, pagination: false, ...q })).docs[0]
    if (byToken && !list.some((x) => x.id === byToken.id)) list.push(byToken)
  }
  for (const inv of list) {
    if ((STAGE[inv.status] ?? 0) >= STAGE[o.status]) continue
    await p.update({ collection: 'referral-invites', id: inv.id, ...q, data: { status: o.status, ...(o.account ? { account: o.account } : {}) } })
  }
}

/** First paid qualifying purchase before this one? (Only a player's first qualifying purchase counts.) */
async function boughtBefore(p: Payload, participantId: number, before: string, skip: { kind: 'booking' | 'academy'; id: number }) {
  const { docs: bks } = await p.find({ collection: 'bookings', where: { participant: { equals: participantId }, status: { in: ['paid', 'refunded'] }, createdAt: { less_than: before } }, limit: 50, pagination: false, depth: 1, overrideAccess: true })
  if (bks.some((b) => !(skip.kind === 'booking' && b.id === skip.id) && bookingReferralProgram(b, typeof b.program === 'object' ? (b.program as Program).type : null))) return true
  const { docs: regs } = await p.find({ collection: 'academy-registrations', where: { participant: { equals: participantId }, status: { equals: 'paid' }, createdAt: { less_than: before } }, limit: 5, pagination: false, ...q })
  if (regs.some((r) => !(skip.kind === 'booking' && rel(r.booking) === skip.id))) return true
  const { totalDocs } = await p.count({ collection: 'academy-bookings', where: { participant: { equals: participantId }, kind: { not_equals: 'group' }, status: { in: ['confirmed', 'completed', 'payment_failed', 'refunded'] }, createdAt: { less_than: before }, ...(skip.kind === 'academy' ? { id: { not_equals: skip.id } } : {}) }, overrideAccess: true })
  return totalDocs > 0
}

type Paid = {
  kind: 'booking' | 'academy'
  id: number
  reference: string
  program: ReferralProgram
  amount: number
  paidAt: string
  startsAt: string | null
  participants: number[]
  account: number | null
  email: string
  phone: string | null
  code: string | null
  createdAt: string
}

/** Create the pending referral(s) for a paid qualifying purchase. Safe to run again (webhook retries). */
async function recordPaid(p: Payload, x: Paid) {
  const s = await referralSettings(p)
  if (!s.enabled || x.amount <= 0 || !x.participants.length) return []
  const account = x.account ? await p.findByID({ collection: 'users', id: x.account, ...q, disableErrors: true }) : null
  // Code: at checkout first, then the one saved on the family's account
  const codeHit = (await resolveCode(p, x.code)) ?? (await resolveCode(p, account?.referralCode))
  const invites = await matchingInvites(p, x.email, x.phone)
  const made: Referral[] = []
  for (const pid of [...new Set(x.participants)]) {
    if ((await p.count({ collection: 'referrals', where: { referred: { equals: pid } }, overrideAccess: true })).totalDocs) continue
    if (await boughtBefore(p, pid, x.createdAt, { kind: x.kind, id: x.id })) continue
    const pick = chooseAttribution({ code: codeHit ? { referrer: codeHit.participant.id } : null, invites: invites.filter((i) => i.status !== 'expired').map((i) => ({ id: i.id, referrer: rel(i.referrer)!, createdAt: i.createdAt })) })
    if (!pick) continue
    // A code from someone who also invited them by name: link the invite too (so their list shows it)
    if (pick.attribution === 'code' && !pick.invite) pick.invite = invites.find((i) => rel(i.referrer) === pick.referrer)?.id ?? null
    const referrer = await p.findByID({ collection: 'participants', id: pick.referrer, ...q, disableErrors: true })
    if (!referrer) continue
    const referrerAccount = rel(referrer.account)
    // No self-referral: the referrer's own family can't be the referred family
    const ra = referrerAccount ? await p.findByID({ collection: 'users', id: referrerAccount, ...q, disableErrors: true }) : null
    if (referrerAccount && (referrerAccount === x.account || lc(ra?.email) === lc(x.email) || (ra?.phone && e164(ra.phone) === e164(x.phone)))) continue
    // The referred family must be new: nothing with this email/mobile before they were invited or arrived with the code
    // (10 minutes' grace: an account or sign-up made in the same visit doesn't make them 'existing')
    const firstTouch = [pick.invite ? invites.find((i) => i.id === pick.invite)?.createdAt : null, account?.referralCodeAt, x.createdAt].filter(Boolean).sort()[0] as string
    if (await existingFamily(p, { email: x.email, phone: x.phone, before: new Date(Date.parse(firstTouch) - 10 * 60_000).toISOString(), ignore: [{ collection: x.kind === 'booking' ? 'bookings' : 'academy-bookings', id: x.id }] })) continue
    const confirmAfter = confirmAfterFor(x.program, new Date(x.paidAt), { windowDays: s.windows[x.program], startsAt: x.startsAt })
    try {
      const r = await p.create({
        collection: 'referrals',
        ...q,
        data: {
          referrer: referrer.id, referrerAccount, referred: pid, referredAccount: x.account, invite: pick.invite, attribution: pick.attribution, program: x.program,
          sourceKind: x.kind, sourceId: x.id, reference: x.reference, amount: x.amount, paidAt: x.paidAt, confirmAfter: confirmAfter.toISOString(), status: 'pending',
          history: [{ at: new Date().toISOString(), action: 'Paid — pending', note: `${programLabel(x.program)} ${x.reference}` }],
        },
      })
      made.push(r)
    } catch {
      /* already recorded (unique per referred player) */
    }
  }
  if (made.length) {
    if (x.account && codeHit) await saveCodeOnAccount(p, x.account, codeHit.code)
    await advanceInvites(p, { email: x.email, phone: x.phone, status: 'paid', account: x.account })
  }
  return made
}

/** Rowville Eagles registration: the code saved when they registered for the trial. */
async function entryCode(p: Payload, b: Booking) {
  const id = rel(b.selectionEntry)
  if (!id) return null
  const e = await p.findByID({ collection: 'selection-entries', id, ...q, disableErrors: true })
  return e?.referralCode ?? null
}

/** Called when a camp / program / term / registration booking is paid. */
export async function recordBookingReferral(p: Payload, bookingId: number) {
  const b = (await p.findByID({ collection: 'bookings', id: bookingId, depth: 1, overrideAccess: true, disableErrors: true })) as Booking | null
  if (!b || b.status !== 'paid') return []
  const program = typeof b.program === 'object' ? (b.program as Program) : null
  const kind = bookingReferralProgram(b, program?.type)
  if (!kind || !program) return []
  // Academy terms: each registration's player (siblings can share one checkout)
  let participants = [rel(b.participant)].filter(Boolean) as number[]
  let startsAt = program.startDate ?? null
  if (kind === 'academy-term') {
    const { docs } = await p.find({ collection: 'academy-registrations', where: { booking: { equals: b.id } }, limit: 20, pagination: false, ...q })
    participants = [...new Set([...participants, ...(docs.map((r) => rel(r.participant)).filter(Boolean) as number[])])]
    if (program.type === 'academy-year') {
      const starts = docs.map((r) => (typeof r.program === 'object' ? r.program?.startDate : null)).filter(Boolean) as string[]
      startsAt = starts.sort()[0] ?? startsAt
    }
  }
  if (kind === 'holiday-camp' && b.campDays?.length && !b.fullCamp) startsAt = [...b.campDays.map((d) => `${d.day}T00:00:00+10:00`)].sort()[0]
  if (b.sessionStart) startsAt = b.sessionStart
  return recordPaid(p, {
    kind: 'booking', id: b.id, reference: b.reference ?? '', program: kind, amount: b.amount ?? 0, paidAt: new Date().toISOString(), startsAt,
    participants, account: rel(b.account), email: b.contact.email, phone: b.contact.phone ?? null, code: b.referralCode ?? (await entryCode(p, b)) ?? null, createdAt: b.createdAt,
  })
}

/** Called when a 1-on-1 booking is confirmed (small groups don't count). */
export async function recordAcademyReferral(p: Payload, bookingId: number) {
  const b = (await p.findByID({ collection: 'academy-bookings', id: bookingId, ...q, disableErrors: true })) as AcademyBooking | null
  if (!b || b.kind === 'group' || !['confirmed', 'completed'].includes(b.status)) return []
  const paid = (b.amount ?? 0) - (b.creditApplied ?? 0)
  return recordPaid(p, {
    kind: 'academy', id: b.id, reference: b.reference, program: 'one-on-one', amount: paid, paidAt: new Date().toISOString(), startsAt: b.firstSessionAt ?? null,
    participants: [rel(b.participant)].filter(Boolean) as number[], account: rel(b.account), email: b.contact.email, phone: b.contact.mobile ?? null, code: b.referralCode ?? null, createdAt: b.createdAt,
  })
}

const note = (r: Referral, action: string, by?: number | null, text?: string) => [...(r.history ?? []), { at: new Date().toISOString(), action, by: by ?? null, note: text }]

/** The purchase was cancelled or fully refunded: a pending referral no longer counts (a confirmed one is flagged for review). */
export async function voidReferralFor(p: Payload, kind: 'booking' | 'academy', sourceId: number, why: string) {
  const { docs } = await p.find({ collection: 'referrals', where: { sourceKind: { equals: kind }, sourceId: { equals: sourceId }, status: { not_equals: 'voided' } }, limit: 20, pagination: false, ...q })
  for (const r of docs) {
    if (r.status === 'pending') await p.update({ collection: 'referrals', id: r.id, ...q, data: { status: 'voided', history: note(r, 'Voided', null, why) } })
    else await p.update({ collection: 'referrals', id: r.id, ...q, data: { reviewFlag: `${why} after it was confirmed — check whether it should still count`, history: note(r, 'Flagged', null, why) } })
  }
  return docs.length
}

/** A Stripe refund (any route) for a payment reference. */
export async function voidReferralForReference(p: Payload, reference: string, why: string) {
  const { docs } = await p.find({ collection: 'referrals', where: { reference: { equals: reference } }, limit: 20, pagination: false, ...q })
  for (const r of docs) await voidReferralFor(p, r.sourceKind as 'booking' | 'academy', r.sourceId, why)
}

/** Is the purchase still standing (paid, not cancelled/refunded), and has its start gone ahead? */
async function sourceState(p: Payload, r: Referral): Promise<'ok' | 'gone' | 'wait'> {
  if (r.sourceKind === 'booking') {
    const b = await p.findByID({ collection: 'bookings', id: r.sourceId, ...q, disableErrors: true })
    return b && b.status === 'paid' ? 'ok' : 'gone'
  }
  const b = await p.findByID({ collection: 'academy-bookings', id: r.sourceId, ...q, disableErrors: true })
  if (!b || !['confirmed', 'completed', 'payment_failed'].includes(b.status)) return 'gone'
  // 1-on-1: the first session that wasn't cancelled must have gone ahead
  const { docs } = await p.find({ collection: 'academy-sessions', where: { booking: { equals: b.id }, status: { not_equals: 'cancelled' } }, sort: 'startsAt', limit: 1, pagination: false, ...q })
  if (!docs[0]) return 'gone'
  return new Date(docs[0].startsAt) <= new Date() ? 'ok' : 'wait'
}

/** Hourly: pending referrals whose time has come → confirmed (or voided if the purchase is gone); then rewards. */
export async function runReferralConfirmations(p: Payload, now = new Date()) {
  const { docs } = await p.find({ collection: 'referrals', where: { status: { equals: 'pending' }, confirmAfter: { less_than_equal: now.toISOString() } }, limit: 200, pagination: false, ...q })
  const touched = new Set<number>()
  let confirmed = 0
  for (const r of docs) {
    const st = await sourceState(p, r)
    if (st === 'wait') {
      await p.update({ collection: 'referrals', id: r.id, ...q, data: { confirmAfter: new Date(now.getTime() + 3600_000).toISOString() } })
      continue
    }
    if (st === 'gone') {
      await p.update({ collection: 'referrals', id: r.id, ...q, data: { status: 'voided', history: note(r, 'Voided', null, 'Cancelled or refunded before it counted') } })
      continue
    }
    await p.update({ collection: 'referrals', id: r.id, ...q, data: { status: 'confirmed', confirmedAt: now.toISOString(), history: note(r, 'Confirmed') } })
    confirmed++
    touched.add(rel(r.referrer)!)
  }
  let unlocked = 0
  for (const pid of touched) unlocked += (await grantMilestones(p, pid)).length
  // Invite links past their expiry (a code saved on an account keeps working)
  await p.update({ collection: 'referral-invites', where: { status: { in: ['invited', 'signed_up'] }, expiresAt: { less_than: now.toISOString() } }, ...q, data: { status: 'expired' } }).catch(() => null)
  return { confirmed, unlocked }
}

export const confirmedCount = async (p: Payload, participantId: number) => (await p.count({ collection: 'referrals', where: { referrer: { equals: participantId }, status: { equals: 'confirmed' } }, overrideAccess: true })).totalDocs

/** Unlock every milestone the player has reached (each once), issue credits, tell the family and Management. */
export async function grantMilestones(p: Payload, participantId: number) {
  const kid = await p.findByID({ collection: 'participants', id: participantId, ...q, disableErrors: true })
  if (!kid) return []
  const count = await confirmedCount(p, participantId)
  const all = await milestones(p)
  const { docs: have } = await p.find({ collection: 'referral-rewards', where: { participant: { equals: participantId } }, limit: 100, pagination: false, ...q })
  const due = milestonesDue(count, all, have.map((g) => rel(g.milestone)!))
  const accountId = rel(kid.account)
  const account = accountId ? await p.findByID({ collection: 'users', id: accountId, ...q, disableErrors: true }) : null
  const out = []
  for (const m of due) {
    let grant
    try {
      grant = await p.create({ collection: 'referral-rewards', ...q, data: { participant: participantId, account: accountId, milestone: m.id, status: account ? 'unlocked' : 'held', note: account ? undefined : 'Family account missing — check before giving the reward' } })
    } catch {
      continue // already granted
    }
    if (account) await issueCredit(p, grant.id, m, account, kid).catch((e) => p.logger.error({ err: e, msg: `Referral reward credit ${grant.id} failed` }))
    out.push({ grant, milestone: m })
  }
  if (out.length) await notifyUnlocked(p, kid, account, out.map((o) => o.milestone), count)
  return out
}

/** 1-on-1 → a session credit (1-on-1s only); Academy term → a one-use 100% promotion for this family, Academy terms only. */
export async function issueCredit(p: Payload, grantId: number, m: ReferralMilestone, account: User, kid: Participant) {
  if (m.rewardType === 'one_on_one_credit') {
    const { giveCredit } = await import('../academy/credits')
    const c = await giveCredit(p, { account: account.id, sessions: 1, reason: 'referral', note: `Refer a Friend reward for ${kid.firstName} (${m.rewardName})`, scope: 'any' })
    if (c) await p.update({ collection: 'referral-rewards', id: grantId, ...q, data: { credit: c.id } })
  } else if (m.rewardType === 'academy_term_credit') {
    const promo = await p.create({
      collection: 'promotions',
      ...q,
      data: { name: `Refer a Friend reward — free Academy term (${kid.firstName})`, status: 'live', type: 'percent', value: 100, usesPerFamily: 1, programGroups: ['academy-term'], recipients: [account.id], startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 365 * 86_400_000).toISOString() } as never,
    })
    await p.update({ collection: 'referral-rewards', id: grantId, ...q, data: { promotion: promo.id } })
  }
}

async function notifyUnlocked(p: Payload, kid: Participant, account: User | null, ms: ReferralMilestone[], count: number) {
  const names = ms.map((m) => m.rewardName).join(', ')
  if (account?.email) {
    const physical = ms.some((m) => m.rewardType === 'physical_item')
    await sendEmail(p, {
      to: account.email,
      subject: `${kid.firstName} unlocked: ${names}!`,
      html: emailLayout('academy', [{ heading: `${esc(kid.firstName)} unlocked a reward`, intro: `Thanks for spreading the word — ${esc(kid.firstName)} now has <strong>${count} confirmed referrals</strong> and has unlocked <strong>${esc(names)}</strong>.${physical ? ' Claim it (and choose a size) from Refer a Friend in your account.' : ' It’s been added to your account and is used automatically at checkout.'}`, cta: { label: 'Open Refer a Friend', href: `${siteUrl()}/account/referrals?player=${kid.id}` } }]),
      sender: 'academy',
      userId: account.id,
    }).catch(() => null)
  }
  await sendEmail(p, { to: academyBrand.email, subject: `Referral reward unlocked: ${kid.firstName} ${kid.lastName} — ${names}`, html: emailLayout('academy', [{ heading: 'Referral reward unlocked', intro: `${esc(kid.firstName)} ${esc(kid.lastName)} reached ${count} confirmed referrals and unlocked ${esc(names)}.`, cta: { label: 'Referral rewards', href: `${siteUrl()}/management/referrals?tab=rewards` } }]), sender: 'academy' }).catch(() => null)
}

/** Parent claims a physical reward (with a size). */
export async function claimReward(p: Payload, user: User, grantId: number, size?: string) {
  const g = await p.findByID({ collection: 'referral-rewards', id: grantId, depth: 1, overrideAccess: true, disableErrors: true })
  if (!g || rel(g.account) !== user.id) throw new ReferralError('That reward isn’t on your account.')
  const m = g.milestone as ReferralMilestone
  if (m.rewardType !== 'physical_item') throw new ReferralError('This reward is used automatically at checkout.')
  if (g.status !== 'unlocked') throw new ReferralError('This reward has already been claimed.')
  const sizes = (m.sizes ?? '').split(',').map((x) => x.trim()).filter(Boolean)
  if (sizes.length && !sizes.includes(size ?? '')) throw new ReferralError('Choose a size.')
  await p.update({ collection: 'referral-rewards', id: g.id, ...q, data: { status: 'claimed', size: size || null, claimedAt: new Date().toISOString() } })
  const kid = await p.findByID({ collection: 'participants', id: rel(g.participant)!, ...q, disableErrors: true })
  await sendEmail(p, { to: academyBrand.email, subject: `Referral reward to send: ${m.rewardName}${size ? ` (${size})` : ''} for ${kid?.firstName ?? ''} ${kid?.lastName ?? ''}`, html: emailLayout('academy', [{ heading: 'A referral reward was claimed', intro: `${esc(kid?.firstName ?? '')} ${esc(kid?.lastName ?? '')} claimed <strong>${esc(m.rewardName)}</strong>${size ? ` in size <strong>${esc(size)}</strong>` : ''}.`, cta: { label: 'Fulfilment queue', href: `${siteUrl()}/management/referrals?tab=rewards` } }]), sender: 'academy' }).catch(() => null)
}

/** Free term rewards: "redeemed" once the promotion has been used at a checkout. (1-on-1 credits sit in the family's session credits.) */
export async function rewardRedeemed(p: Payload, g: { promotion?: unknown }) {
  if (rel(g.promotion)) return (await p.count({ collection: 'promotion-uses', where: { promotion: { equals: rel(g.promotion) }, status: { equals: 'paid' } }, overrideAccess: true })).totalDocs > 0
  return false
}

export { programLabel }
