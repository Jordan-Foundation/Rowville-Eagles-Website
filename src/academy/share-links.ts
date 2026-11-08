import type { Payload } from 'payload'
import type { AcademyCoach, AcademyShareLink, AcademyTerm, User } from '@/payload-types'
import { emailLayout, esc } from '../lib/email-templates'
import { sendEmail } from '../lib/email'
import { formatAUD, formatDate } from '../lib/format'
import { siteUrl } from '../lib/payments'
import { makeReference } from '../lib/reference'
import { sendSms, toE164 } from '../lib/sms'
import { createHold, loadTermBookingData, openTerms, releaseBooking, releaseExpiredHolds } from './booking-data'
import { casualSlots, findTermSlot, isCasualOpen, termSlots } from './slots'
import { toYmd } from './term-dates'
import { hashShareToken, holdUntil, linkExpiry, newShareToken, validShareToken } from './share-rules'

const rel = (v: unknown) => (v && typeof v === 'object' ? (v as { id: number }).id : (v as number | null | undefined) ?? null)
const q = { overrideAccess: true } as const
export class ShareLinkError extends Error {}

export const shareUrl = (token: string) => `${siteUrl()}/academy/book/l/${token}`
const when = (iso: string) => formatDate(iso, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })
const short = (iso: string) => formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** This coach's open times in the current term (casual) or open weekly slots (term). */
export async function coachOpenSlots(p: Payload, coachId: number) {
  await releaseExpiredHolds(p)
  const term = (await openTerms(p))[0]
  if (!term) return null
  const data = await loadTermBookingData(p, term)
  const mine = data.availability.filter((a) => a.coachId === coachId)
  const engine = { term, coaches: mine, taken: data.taken, now: new Date(), cutoffHours: term.bookingCutoffHours ?? 24 }
  return {
    term,
    casual: casualSlots(engine).map((s) => s.startsAt),
    weekly: termSlots({ ...engine, minSessions: term.minTermSessions ?? 2 }).map((s) => ({ weekday: s.weekday, time: s.time, sessions: s.sessions })),
  }
}

/** Work out the sessions and price for a slot, checking it's still open (optionally ignoring one reservation). */
async function resolveSlot(p: Payload, term: AcademyTerm, coachId: number, slot: { mode: 'casual' | 'term'; startsAt?: string | null; weekday?: string | null; startTime?: string | null }, ignoreBooking?: number | null) {
  const data = await loadTermBookingData(p, term, { ignoreBooking })
  const engine = { term, coaches: data.availability, taken: data.taken, now: new Date(), cutoffHours: term.bookingCutoffHours ?? 24 }
  if (slot.mode === 'term') {
    const s = findTermSlot({ ...engine, minSessions: term.minTermSessions ?? 2, coachId, weekday: slot.weekday ?? '', time: slot.startTime ?? '' })
    if (!s) return null
    const away = new Set(s.awayDates[coachId] ?? [])
    return { sessions: s.sessions.map((startsAt) => ({ startsAt, needsCover: away.has(toYmd(startsAt)) })), amount: term.pricePerSession * s.sessions.length, weekday: s.weekday, startTime: s.time }
  }
  if (!slot.startsAt || !isCasualOpen({ ...engine, coachId, startsAt: slot.startsAt })) return null
  return { sessions: [{ startsAt: new Date(slot.startsAt).toISOString() }], amount: term.casualPrice, weekday: undefined, startTime: undefined }
}

function slotText(l: Pick<AcademyShareLink, 'mode' | 'startsAt' | 'weekday' | 'startTime'>, first?: string) {
  if (l.mode === 'term') return `${l.weekday}s at ${first ? formatDate(first, { hour: 'numeric', minute: '2-digit' }) : l.startTime}${first ? `, from ${formatDate(first, { day: 'numeric', month: 'short' })}` : ''}`
  return when(l.startsAt!)
}

export type NewLink = {
  coach: AcademyCoach
  user: User
  mode: 'casual' | 'term'
  startsAt?: string
  weekday?: string
  startTime?: string
  client: { firstName: string; lastName: string; email: string; mobile?: string; playerFirstName?: string }
  message?: string
  holdHours: number
  viaEmail: boolean
  viaSms: boolean
}

/** Create a link, reserve the time if asked, and send it to the family. */
export async function createShareLink(p: Payload, o: NewLink) {
  await releaseExpiredHolds(p)
  const term = (await openTerms(p))[0]
  if (!term) throw new ShareLinkError('There’s no open term to book into.')
  const slot = await resolveSlot(p, term, o.coach.id, { mode: o.mode, startsAt: o.startsAt, weekday: o.weekday, startTime: o.startTime })
  if (!slot) throw new ShareLinkError('That time isn’t free any more — choose another.')
  const now = new Date()
  const cutoffHours = term.bookingCutoffHours ?? 24
  const first = slot.sessions[0].startsAt
  const until = holdUntil({ hours: o.holdHours, now, firstSessionAt: first, cutoffHours })
  const token = newShareToken()
  const label = `${o.client.firstName} ${o.client.lastName} — ${o.coach.displayName}, ${o.mode === 'term' ? `${slot.weekday}s ${slot.startTime}` : short(first)}`

  let holdBooking: number | undefined
  if (until) {
    // The reservation is a held booking (the same mechanism as checkout), so nobody else can take the time
    const hold = await createHold(p, {
      reference: makeReference('RFA'),
      type: o.mode,
      paymentMode: o.mode === 'casual' ? 'casual' : 'upfront',
      amount: slot.amount,
      sessionsTotal: slot.sessions.length,
      sessionsPaid: 0,
      coach: o.coach.id,
      term: term.id,
      weekday: slot.weekday as never,
      startTime: slot.startTime,
      firstSessionAt: first,
      contact: { firstName: o.client.firstName, lastName: o.client.lastName, email: o.client.email, mobile: o.client.mobile || 'not given' },
      player: { firstName: o.client.playerFirstName || 'To be confirmed', lastName: o.client.lastName, dateOfBirth: '2000-01-01', emergencyName: 'To be confirmed', emergencyPhone: 'To be confirmed' },
      source: 'coach-link',
      sessions: slot.sessions,
      holdMinutes: Math.round((until.getTime() - now.getTime()) / 60_000) - 2,
    })
    if (!hold.ok) throw new ShareLinkError('Someone booked that time a moment ago — choose another.')
    holdBooking = hold.booking.id
  }

  const link = await p.create({
    collection: 'academy-share-links',
    ...q,
    data: {
      label,
      status: 'active',
      tokenHash: hashShareToken(token),
      coach: o.coach.id,
      term: term.id,
      mode: o.mode,
      startsAt: o.mode === 'casual' ? first : undefined,
      weekday: slot.weekday as never,
      startTime: slot.startTime,
      client: { ...o.client, mobile: o.client.mobile || undefined, playerFirstName: o.client.playerFirstName || undefined },
      message: o.message || undefined,
      holdHours: until ? o.holdHours : 0,
      holdUntil: until?.toISOString(),
      expiresAt: linkExpiry({ now, firstSessionAt: first, cutoffHours }).toISOString(),
      holdBooking,
      createdBy: o.user.id,
    },
  })
  const sent = await sendShareLink(p, link, token, { coach: o.coach, term, first, sessions: slot.sessions.length, amount: slot.amount, viaEmail: o.viaEmail, viaSms: o.viaSms })
  return { link, url: shareUrl(token), ...sent }
}

async function sendShareLink(p: Payload, link: AcademyShareLink, token: string, o: { coach: AcademyCoach; term: AcademyTerm; first: string; sessions: number; amount: number; viaEmail: boolean; viaSms: boolean }) {
  const url = shareUrl(token)
  const c = link.client
  const who = c.playerFirstName || 'your player'
  const held = link.holdUntil ? `${o.coach.displayName} is holding this time for you until ${when(link.holdUntil)}.` : 'Book soon — this time isn’t held, so someone else could take it.'
  let sentEmail = false
  let sentSms = false
  if (o.viaEmail) {
    const html = emailLayout('academy', [{
      heading: `${esc(o.coach.displayName)} has a time for ${esc(who)}`,
      intro: `Hi ${esc(c.firstName)},${link.message ? `<br><br><em>${esc(link.message)}</em><br>— ${esc(o.coach.displayName)}` : ''}<br><br>${esc(held)}`,
      rows: [
        ['Coach', o.coach.displayName],
        [link.mode === 'term' ? 'Weekly' : 'When', slotText(link, o.first)],
        ...(link.mode === 'term' ? ([['Sessions', `${o.sessions} this term`]] as [string, string][]) : []),
        ['Where', o.term.location || ''],
        ['Price', link.mode === 'term' ? `${formatAUD(o.term.pricePerSession)} a session (${formatAUD(o.amount)} for the term)` : formatAUD(o.amount)],
      ],
      cta: { label: 'Book this time', href: url },
      after: 'The link opens the booking with everything filled in — just add your player’s details and pay.',
    }])
    await sendEmail(p, { to: c.email, subject: `${o.coach.displayName} is holding a 1-on-1 time for ${who}`, html, sender: 'academy' })
    sentEmail = true
  }
  if (o.viaSms && c.mobile) {
    const user = (await p.find({ pagination: false, collection: 'users', where: { email: { equals: c.email.toLowerCase() } }, limit: 1, depth: 0, ...q })).docs[0]
    const r = await sendSms(p, {
      to: c.mobile,
      kind: 'service',
      optedOut: user?.smsOptOut,
      userId: user?.id,
      body: `Hi ${c.firstName}, ${o.coach.displayName} from Foundation Academy has ${link.holdUntil ? 'held' : 'found'} a 1-on-1 time for ${who}: ${link.mode === 'term' ? slotText(link, o.first) : short(o.first)}.${link.holdUntil ? ` Held until ${short(link.holdUntil)}.` : ''} Book: ${url}`,
    })
    sentSms = r.sent
  }
  await p.update({ collection: 'academy-share-links', id: link.id, ...q, data: { sentEmail, sentSms } })
  return { sentEmail, sentSms }
}

/** A live link from its secret, or null (unknown, cancelled, booked or past its date). */
export async function findShareLink(p: Payload, token: string | null | undefined) {
  if (!token || !validShareToken(token)) return null
  const { docs } = await p.find({ pagination: false, collection: 'academy-share-links', where: { tokenHash: { equals: hashShareToken(token) } }, limit: 1, depth: 0, ...q })
  const link = docs[0]
  if (!link || link.status !== 'active' || (link.expiresAt && new Date(link.expiresAt) <= new Date())) return null
  return link
}

/** Booking-page address for a link (coach + time chosen, details filled in). */
export function bookPath(link: AcademyShareLink, token: string) {
  const coach = rel(link.coach)
  return link.mode === 'term'
    ? `/academy/1-on-1/book?mode=term&coach=${coach}&weekday=${link.weekday}&time=${link.startTime}&share=${token}`
    : `/academy/1-on-1/book?coach=${coach}&start=${encodeURIComponent(link.startsAt!)}&share=${token}`
}

/** Does this link belong to exactly this coach + time? */
export function linkMatches(link: AcademyShareLink, o: { mode: string; coach: number; start?: string; weekday?: string; time?: string }) {
  if (rel(link.coach) !== o.coach || link.mode !== o.mode) return false
  return link.mode === 'term' ? link.weekday === o.weekday && link.startTime === o.time : Boolean(o.start && link.startsAt && new Date(link.startsAt).getTime() === new Date(o.start).getTime())
}

/** The live reservation behind a link (still held), if any. */
export async function activeHold(p: Payload, link: AcademyShareLink) {
  const id = rel(link.holdBooking)
  if (!id) return null
  const b = await p.findByID({ collection: 'academy-bookings', id, depth: 0, ...q, disableErrors: true })
  return b && b.status === 'held' && b.holdExpiresAt && new Date(b.holdExpiresAt) > new Date() ? b : null
}

/** Free the coach's reservation (the family is about to check out, or the coach cancelled the link). */
export async function releaseShareHold(p: Payload, link: AcademyShareLink) {
  const b = await activeHold(p, link)
  if (b) await releaseBooking(p, b, 'cancelled')
}

export async function cancelShareLink(p: Payload, coachId: number, id: number) {
  const link = await p.findByID({ collection: 'academy-share-links', id, depth: 0, ...q, disableErrors: true })
  if (!link || rel(link.coach) !== coachId) throw new ShareLinkError('Link not found.')
  if (link.status !== 'active') throw new ShareLinkError('This link has already been used or cancelled.')
  await releaseShareHold(p, link)
  await p.update({ collection: 'academy-share-links', id, ...q, data: { status: 'cancelled' } })
}

/** Send again with a fresh link (only a hash is kept, so the old link stops working). */
export async function resendShareLink(p: Payload, coach: AcademyCoach, id: number) {
  const link = await p.findByID({ collection: 'academy-share-links', id, depth: 0, ...q, disableErrors: true })
  if (!link || rel(link.coach) !== coach.id || link.status !== 'active') throw new ShareLinkError('This link can’t be resent.')
  const term = await p.findByID({ collection: 'academy-terms', id: rel(link.term)!, depth: 0, ...q })
  const hold = await activeHold(p, link)
  const slot = await resolveSlot(p, term, coach.id, link, hold?.id)
  if (!slot) throw new ShareLinkError('That time has been booked by someone else — cancel this link and send a new one.')
  const token = newShareToken()
  const fresh = await p.update({ collection: 'academy-share-links', id, ...q, data: { tokenHash: hashShareToken(token), ...(hold ? {} : { holdUntil: null }) } })
  return sendShareLink(p, fresh, token, { coach, term, first: slot.sessions[0].startsAt, sessions: slot.sessions.length, amount: slot.amount, viaEmail: true, viaSms: Boolean(link.client.mobile) })
}

export async function myShareLinks(p: Payload, coachId: number) {
  const { docs } = await p.find({ pagination: false, collection: 'academy-share-links', where: { coach: { equals: coachId } }, sort: '-createdAt', limit: 50, depth: 0, ...q })
  const holds = await Promise.all(docs.map((l) => activeHold(p, l)))
  return docs.map((l, i) => ({ link: l, holdActive: Boolean(holds[i]) }))
}

export { toE164 }
