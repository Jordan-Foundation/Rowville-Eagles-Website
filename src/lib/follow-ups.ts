/**
 * Automatic follow-ups that turn interest into bookings:
 *  - Free trials: a reminder the day before (email + text), an "enrol now" email after the trial and one last
 *    reminder 4 days later — skipped once the family enrols, or if they tap "no more emails about this".
 *  - Unfinished bookings: someone filled in a paid booking (camp, program, term, 1-on-1) but didn't pay — one email
 *    with a link that reopens the form with everything they typed.
 * Each email is sent once (the time is recorded on the booking).
 */
import type { Payload, Where } from 'payload'
import type { AcademyBooking, Booking, Program } from '@/payload-types'
import { sendEmail } from './email'
import { emailLayout, esc } from './email-templates'
import { cardPrice, formatAUD } from './format'
import { siteUrl } from './payments'
import { sendSms } from './sms'
import { dayWord, recoveryDue, timeWord, trialEnrolDue, trialNudgeDue, trialReminderDue } from './follow-up-rules'
import { makeFollowToken } from './follow-up-token'
import { programPlace } from './place'
import { campChoiceLabel, campDayList } from './camps'

const q = { overrideAccess: true, depth: 0 } as const
const idOf = (x: unknown) => (x && typeof x === 'object' ? (x as { id: number }).id : (x as number | null | undefined))
const lower = (s?: string | null) => (s ?? '').trim().toLowerCase()
const brandOf = (prog: Program | null | undefined, payee?: string | null) => (prog?.brand === 'academy' || payee === 'academy' ? 'academy' : 'club') as 'academy' | 'club'

async function settings(p: Payload) {
  const s = await p.findGlobal({ slug: 'site-settings', depth: 0 })
  return { phone: s.phone || '0495 101 515', email: s.email || undefined, address: s.ground?.address ?? null }
}

/** Same email, either case (older bookings kept the email as typed). */
const emailIs = (path: string, email: string): Where => ({ or: [{ [path]: { equals: email } }, { [path]: { equals: lower(email) } }] })

/** Has this family booked something since (a term, the full year, a 1-on-1)? Then the trial worked: stop. */
async function enrolledSince(p: Payload, email: string, since: string) {
  const { docs } = await p.find({ collection: 'bookings', where: { and: [emailIs('contact.email', email), { status: { equals: 'paid' } }, { bookingType: { not_equals: 'trial' } }, { createdAt: { greater_than: since } }] }, limit: 20, overrideAccess: true, depth: 1 })
  if (docs.some((b) => ['academy-term', 'academy-year', 'toddler'].includes((b.program as Program | null)?.type ?? ''))) return true
  const { totalDocs } = await p.count({ collection: 'academy-bookings', where: { and: [emailIs('contact.email', email), { status: { in: ['confirmed', 'completed'] } }, { createdAt: { greater_than: since } }] }, overrideAccess: true })
  return totalDocs > 0
}

/** Where to enrol after a trial: the trial's own program if it's still taking bookings, else the next one of its kind. */
async function enrolTarget(p: Payload, prog: Program, now: Date): Promise<Program | null> {
  const live = (x: Program) => x.status === 'open' && (!x.endDate || new Date(x.endDate) > now)
  if (live(prog)) return prog
  const types = prog.type === 'toddler' ? ['toddler'] : ['academy-term', 'academy-year']
  const { docs } = await p.find({ collection: 'programs', where: { type: { in: types }, status: { equals: 'open' } }, sort: 'startDate', limit: 10, ...q })
  return docs.find(live) ?? null
}

function priceLine(prog: Program) {
  const c = cardPrice(prog)
  if (!c.amount) return null
  const per = prog.type === 'academy-term' && prog.pricingMode === 'per-term'
  return `${c.from ? 'From ' : ''}${formatAUD(c.amount)}${c.unit ? ` ${c.unit.replace('/ ', 'a ')}` : ''}${per ? ' (pro-rata if you join after the start)' : ''}`
}

/** The venue in a text message: the club's home ground by name, otherwise the program's own location. */
const HOME_GROUND = 'Park Ridge Reserve'
export const smsVenue = (location?: string | null) => (!location || /^home ground$/i.test(location.trim()) ? HOME_GROUND : location.trim())

const stopLink = (ref: string) => `${siteUrl()}/follow-ups/stop/${makeFollowToken(ref)}`
const detailsLink = (ref: string) => `${siteUrl()}/trial-details/${makeFollowToken(ref)}`
export const trialNeedsDetails = (b: Pick<Booking, 'player'>) => !b.player?.emergencyName || !b.player?.emergencyPhone

// ─────────────────────────────── Trials ───────────────────────────────

const trialWhere = (extra: Where[]): Where => ({ and: [{ bookingType: { equals: 'trial' } }, { status: { equals: 'paid' } }, { 'followUps.stopped': { not_equals: true } }, ...extra] })

export async function sendTrialReminders(p: Payload, now = new Date()) {
  const { docs } = await p.find({
    collection: 'bookings',
    where: trialWhere([{ sessionStart: { greater_than: new Date(now.getTime() + 3 * 3_600_000).toISOString() } }, { sessionStart: { less_than: new Date(now.getTime() + 26 * 3_600_000).toISOString() } }, { 'followUps.trialReminderAt': { exists: false } }]),
    limit: 200,
    overrideAccess: true,
    depth: 1,
  })
  const s = await settings(p)
  let sent = 0
  for (const b of docs) {
    if (!b.sessionStart || !trialReminderDue({ start: new Date(b.sessionStart), created: new Date(b.createdAt), now })) continue
    // Mark first, so a slow send can't go out twice
    await p.update({ collection: 'bookings', id: b.id, data: { followUps: { ...b.followUps, trialReminderAt: now.toISOString() } }, ...q })
    const prog = b.program as Program
    const brand = brandOf(prog, b.payee)
    const start = new Date(b.sessionStart)
    const when = `${dayWord(start, now)} at ${timeWord(start)}`
    const where = programPlace(prog.location, s.address)
    const kid = b.player?.firstName || 'your child'
    const needs = trialNeedsDetails(b)
    const html = emailLayout(brand, [
      {
        heading: `See you ${dayWord(start, now)}`,
        intro: `A reminder that ${esc(kid)}’s free trial is ${esc(when)}. Please arrive 10 minutes early.`,
        rows: [
          ['When', new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }).format(start)],
          ['Where', where.place || 'Rowville'],
          ['Program', prog.title],
        ],
        ...(needs ? { cta: { label: 'Add emergency contact (1 minute)', href: detailsLink(b.reference!) } } : {}),
        after: [
          needs && `<strong>Before the session:</strong> please add an emergency contact and any medical information — it takes a minute.`,
          `<strong>What to bring:</strong> ${esc(prog.whatToBring || 'Boots, shin pads and a water bottle.')}`,
          where.directions && `<a href="${where.directions}">Get directions</a>`,
          `Can’t make it? Reply to this email or call ${esc(s.phone)} so we can give the spot to another player.`,
        ].filter(Boolean).join('<br><br>'),
      },
    ])
    await sendEmail(p, { to: b.contact.email, subject: `Reminder: ${kid}’s trial is ${when}`, html, sender: brand, replyTo: s.email })
    const { docs: users } = await p.find({ collection: 'users', where: emailIs('email', b.contact.email), limit: 1, ...q })
    await sendSms(p, {
      to: b.contact.phone,
      kind: 'reminder',
      optedOut: users[0]?.smsOptOut,
      userId: users[0]?.id,
      body: `Hi ${b.contact.firstName}, a reminder that ${kid}'s free ${brand === 'academy' ? 'Foundation Academy' : 'Rowville Eagles'} trial is ${when} at ${smsVenue(prog.location)}. Bring boots, shin pads & water.${needs ? ` Please add an emergency contact: ${detailsLink(b.reference!)}` : ''} Can't make it? Call ${s.phone}.`,
    })
    sent++
  }
  return { sent }
}

function enrolEmail(o: { b: Booking; target: Program | null; brand: 'academy' | 'club'; phone: string; last: boolean; trialDay: string }) {
  const kid = o.b.player?.firstName || 'your child'
  const href = o.target ? `${siteUrl()}/programs/${o.target.slug}/book?resume=${makeFollowToken(o.b.reference!)}` : `${siteUrl()}/${o.brand === 'academy' ? 'academy' : 'programs'}`
  const price = o.target && priceLine(o.target)
  return emailLayout(o.brand, [
    {
      heading: o.last ? 'Still thinking about it?' : 'Thanks for coming along',
      intro: o.last
        ? `Just a reminder that ${esc(kid)} can still join${o.target ? ` ${esc(o.target.title)}` : ' the Academy'}. Your details are already filled in — it takes a couple of minutes.`
        : `We hope ${esc(kid)} enjoyed their trial on ${esc(o.trialDay)}. If they’d like to keep training with us, you can enrol online in a couple of minutes — we’ve filled in your details.`,
      rows: o.target
        ? ([['Program', o.target.title], price ? ['Price', price] : null, o.target.startDate ? ['Starts', new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(o.target.startDate))] : null].filter(Boolean) as [string, string][])
        : undefined,
      cta: { label: `Enrol ${kid}`, href },
      after: [
        o.brand === 'academy' && `Prefer one-on-one coaching? <a href="${siteUrl()}/academy/1-on-1">Book a 1-on-1 session</a>.`,
        `Questions? Reply to this email or call ${esc(o.phone)}.`,
        `<span style="font-size:12px">Not for you right now? <a href="${stopLink(o.b.reference!)}">No more emails about this trial</a>.</span>`,
      ].filter(Boolean).join('<br><br>'),
    },
  ])
}

export async function sendTrialFollowUps(p: Payload, now = new Date()) {
  const s = await settings(p)
  const out = { enrol: 0, nudge: 0, skipped: 0 }
  const { docs } = await p.find({
    collection: 'bookings',
    where: trialWhere([
      { sessionStart: { less_than: new Date(now.getTime() - 12 * 3_600_000).toISOString() } },
      { sessionStart: { greater_than: new Date(now.getTime() - 30 * 86_400_000).toISOString() } },
      { 'followUps.trialNudgeAt': { exists: false } },
    ]),
    limit: 300,
    overrideAccess: true,
    depth: 1,
  })
  for (const b of docs) {
    const enrolAt = b.followUps?.trialEnrolAt ? new Date(b.followUps.trialEnrolAt) : null
    const due = enrolAt ? trialNudgeDue({ enrolSentAt: enrolAt, now }) : trialEnrolDue({ start: new Date(b.sessionStart!), now })
    if (!due) continue
    const stamp = enrolAt ? { trialNudgeAt: now.toISOString() } : { trialEnrolAt: now.toISOString() }
    await p.update({ collection: 'bookings', id: b.id, data: { followUps: { ...b.followUps, ...stamp } }, ...q })
    if (await enrolledSince(p, b.contact.email, b.createdAt)) {
      // Enrolled: no more emails about this trial
      await p.update({ collection: 'bookings', id: b.id, data: { followUps: { ...b.followUps, ...stamp, trialNudgeAt: now.toISOString() } }, ...q })
      out.skipped++
      continue
    }
    const prog = b.program as Program
    const brand = brandOf(prog, b.payee)
    const target = await enrolTarget(p, prog, now)
    const kid = b.player?.firstName || 'your child'
    const trialDay = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', weekday: 'long' }).format(new Date(b.sessionStart!))
    await sendEmail(p, {
      to: b.contact.email,
      subject: enrolAt ? `Still thinking about ${target?.title ?? 'the Academy'}?` : `How did ${kid}’s trial go? Enrol for ${target?.title ?? 'the term'}`,
      html: enrolEmail({ b, target, brand, phone: s.phone, last: !!enrolAt, trialDay }),
      sender: brand,
      replyTo: s.email,
    })
    if (enrolAt) out.nudge++
    else out.enrol++
  }
  return out
}

// ─────────────────────────── Unfinished bookings ───────────────────────────

const NO_RECOVERY: string[] = ['registration', 'tournament', 'community', 'private-session']

export async function sendRecoveryEmails(p: Payload, now = new Date()) {
  const s = await settings(p)
  const out = { sent: 0, skipped: 0 }
  const window: Where[] = [{ createdAt: { less_than: new Date(now.getTime() - 3_600_000).toISOString() } }, { createdAt: { greater_than: new Date(now.getTime() - 48 * 3_600_000).toISOString() } }]
  const handled = new Set<string>()

  // Camps, programs and Academy terms (newest attempt first, one email per family per program)
  const { docs } = await p.find({
    collection: 'bookings',
    where: { and: [{ status: { in: ['pending', 'cancelled'] } }, { amount: { greater_than: 0 } }, { bookingType: { not_equals: 'trial' } }, { 'followUps.recoveryAt': { exists: false } }, { 'followUps.stopped': { not_equals: true } }, { selectionEntry: { exists: false } }, ...window] },
    sort: '-createdAt',
    limit: 300,
    overrideAccess: true,
    depth: 1,
  })
  for (const b of docs) {
    const prog = b.program as Program | null
    if (!prog || NO_RECOVERY.includes(prog.type ?? '')) continue
    if (b.checkoutGroup && b.checkoutGroup !== b.reference) continue // a brother or sister: the lead booking's email covers them
    const key = `${lower(b.contact.email)}|${prog.id}`
    const mark = () => p.update({ collection: 'bookings', id: b.id, data: { followUps: { ...b.followUps, recoveryAt: now.toISOString() } }, ...q })
    if (handled.has(key)) {
      await mark()
      continue
    }
    if (!recoveryDue({ created: new Date(b.createdAt), now })) continue
    handled.add(key)
    await mark()
    const { totalDocs: paidSince } = await p.count({ collection: 'bookings', where: { and: [emailIs('contact.email', b.contact.email), { program: { equals: prog.id } }, { status: { equals: 'paid' } }, { createdAt: { greater_than: b.createdAt } }] }, overrideAccess: true })
    if (paidSince || prog.status !== 'open' || (prog.endDate && new Date(prog.endDate) < now)) {
      out.skipped++
      continue
    }
    const group = b.checkoutGroup
      ? (await p.find({ collection: 'bookings', where: { checkoutGroup: { equals: b.checkoutGroup } }, sort: 'id', limit: 10, ...q })).docs
      : [b]
    const names = group.map((x) => x.player?.firstName).filter(Boolean).join(' and ') || 'your child'
    const total = group.reduce((n, x) => n + (x.amount ?? 0), 0)
    const brand = brandOf(prog, b.payee)
    const camp = prog.type === 'holiday-camp' ? campDayList(prog) : []
    const html = emailLayout(brand, [
      {
        heading: 'You’re nearly there',
        intro: `You started booking ${esc(names)} into ${esc(prog.title)} but didn’t get to the end of the payment. Your details are saved — tap below to pick up where you left off.`,
        rows: [
          ['Program', prog.title],
          ...(camp.length ? ([['Days', campChoiceLabel({ fullCamp: b.fullCamp, days: (b.campDays ?? []).map((d) => d.day), totalDays: camp.length })]] as [string, string][]) : []),
          [group.length > 1 ? 'Players' : 'Player', names],
          ['Total', formatAUD(total)],
        ],
        cta: { label: 'Finish booking', href: `${siteUrl()}/programs/${prog.slug}/book?resume=${makeFollowToken(b.reference!)}` },
        after: [`Places aren’t held until payment is made.`, `Questions, or something went wrong at the payment step? Reply to this email or call ${esc(s.phone)}.`].join('<br><br>'),
      },
    ])
    await sendEmail(p, { to: b.contact.email, subject: `Finish booking ${names}’s place — ${prog.title}`, html, sender: brand, replyTo: s.email })
    out.sent++
  }

  // 1-on-1 sessions (a time picked, then not paid)
  const { docs: holds } = await p.find({
    collection: 'academy-bookings',
    where: { and: [{ status: { in: ['expired', 'held'] } }, { kind: { not_equals: 'group' } }, { source: { equals: 'web' } }, { packSize: { exists: false } }, { 'followUps.recoveryAt': { exists: false } }, ...window] },
    sort: '-createdAt',
    limit: 200,
    overrideAccess: true,
    depth: 1,
  })
  for (const b of holds) {
    if (b.status === 'held' && (!b.holdExpiresAt || new Date(b.holdExpiresAt) > now)) continue // still paying
    const key = `${lower(b.contact.email)}|1on1`
    const mark = () => p.update({ collection: 'academy-bookings', id: b.id, data: { followUps: { recoveryAt: now.toISOString() } }, ...q })
    if (handled.has(key)) {
      await mark()
      continue
    }
    if (!recoveryDue({ created: new Date(b.createdAt), now })) continue
    handled.add(key)
    await mark()
    const { totalDocs: since } = await p.count({ collection: 'academy-bookings', where: { and: [emailIs('contact.email', b.contact.email), { status: { in: ['confirmed', 'completed'] } }, { createdAt: { greater_than: b.createdAt } }] }, overrideAccess: true })
    if (since) {
      out.skipped++
      continue
    }
    const coachId = idOf(b.coach)
    const first = b.firstSessionAt ? new Date(b.firstSessionAt) : null
    const stillAhead = first && first.getTime() > now.getTime() + 24 * 3_600_000
    const token = makeFollowToken(b.reference)
    const href = !stillAhead
      ? `${siteUrl()}/academy/1-on-1`
      : b.type === 'term'
        ? `${siteUrl()}/academy/1-on-1/book?mode=term&coach=${coachId}&weekday=${encodeURIComponent(b.weekday ?? '')}&time=${encodeURIComponent(b.startTime ?? '')}&resume=${token}`
        : `${siteUrl()}/academy/1-on-1/book?coach=${coachId}&start=${encodeURIComponent(b.firstSessionAt!)}&resume=${token}`
    const coach = typeof b.coach === 'object' ? b.coach : null
    const whenText = first ? new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }).format(first) : ''
    const html = emailLayout('academy', [
      {
        heading: 'You’re nearly there',
        intro: stillAhead
          ? `You picked a 1-on-1 session for ${esc(b.player.firstName)} but didn’t finish paying, so the time was released. If it’s still free you can book it now — your details are saved.`
          : `You picked a 1-on-1 session for ${esc(b.player.firstName)} but didn’t finish paying. That time has now passed or is too close to book — choose another time below.`,
        rows: [
          ...(whenText ? ([[b.type === 'term' ? 'First session' : 'When', whenText]] as [string, string][]) : []),
          ...(coach?.displayName ? ([['Coach', coach.displayName]] as [string, string][]) : []),
          ['Price', formatAUD(b.amount ?? 0)],
        ],
        cta: { label: stillAhead ? 'Finish booking' : 'Choose a time', href },
        after: `Questions, or something went wrong at the payment step? Reply to this email or call ${esc(s.phone)}.`,
      },
    ])
    await sendEmail(p, { to: b.contact.email, subject: `Finish booking ${b.player.firstName}’s 1-on-1 session`, html, sender: 'academy', replyTo: s.email })
    out.sent++
  }
  return out
}

// ─────────────────────────── Reopening a form ───────────────────────────

const ymd = (d?: string | null) => (d ? d.slice(0, 10) : '')

/** The form values to reopen a booking with (from a signed follow-up link). Only for links up to 30 days old. */
export async function resumeValues(p: Payload, reference: string): Promise<{ values: Record<string, string>; programId?: number } | null> {
  const fresh = (created: string) => Date.now() - new Date(created).getTime() < 30 * 86_400_000
  const { docs } = await p.find({ collection: 'bookings', where: { reference: { equals: reference } }, limit: 1, ...q })
  const b = docs[0]
  if (b) {
    if (!fresh(b.createdAt)) return null
    const group = b.checkoutGroup ? (await p.find({ collection: 'bookings', where: { checkoutGroup: { equals: b.checkoutGroup } }, sort: 'id', limit: 10, ...q })).docs : [b]
    const values: Record<string, string> = {
      contactFirstName: b.contact.firstName,
      contactLastName: b.contact.lastName,
      contactEmail: b.contact.email,
      contactPhone: b.contact.phone,
    }
    if (b.bookingType !== 'trial' && b.fullCamp != null) values.campOption = b.fullCamp ? 'full' : 'days'
    if (b.bookingType !== 'trial' && b.campDays?.length) values.campDays = b.campDays.map((d) => d.day).join(',')
    group.forEach((x, i) => {
      const sfx = i === 0 ? '' : `_${i + 1}`
      const pl = x.player ?? {}
      const set = (k: string, v?: string | null) => {
        if (v) values[`${k}${sfx}`] = v
      }
      set('playerFirstName', pl.firstName)
      set('playerLastName', pl.lastName)
      set('playerDob', ymd(pl.dateOfBirth))
      set('emergencyName', pl.emergencyName)
      set('emergencyRelationship', pl.emergencyRelationship)
      set('emergencyPhone', pl.emergencyPhone)
      if (pl.medical) {
        const none = /^none\.?$/i.test(pl.medical.trim())
        set('medicalAnswer', none ? 'none' : 'yes')
        if (!none) set('medical', pl.medical)
      }
      if (pl.photoConsent) set('photoConsent', 'on')
      set('keepWith', x.keepWith)
    })
    return { values, programId: idOf(b.program) ?? undefined }
  }
  const { docs: ab } = await p.find({ collection: 'academy-bookings', where: { reference: { equals: reference } }, limit: 1, ...q })
  const a = ab[0] as AcademyBooking | undefined
  if (!a || !fresh(a.createdAt)) return null
  const pl = a.player
  const values: Record<string, string> = {
    contactFirstName: a.contact.firstName,
    contactLastName: a.contact.lastName,
    contactEmail: a.contact.email,
    contactMobile: a.contact.mobile,
    playerFirstName: pl.firstName,
    playerLastName: pl.lastName,
    playerDob: ymd(pl.dateOfBirth),
    emergencyName: pl.emergencyName,
    emergencyPhone: pl.emergencyPhone,
  }
  for (const [k, v] of [['currentClub', pl.currentClub], ['position', pl.position], ['goals', pl.goals], ['medical', pl.medical]] as const) if (v) values[k] = v
  if (pl.photoConsent) values.photoConsent = 'on'
  return { values }
}
